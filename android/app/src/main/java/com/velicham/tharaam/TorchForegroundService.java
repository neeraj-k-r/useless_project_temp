package com.velicham.tharaam;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Foreground service that keeps the phone listening for Velicham Tharaam
 * torch signals even when the app is backgrounded or the screen is off.
 *
 * It polls Firestore (torchEvents is public-read) over REST and drives the
 * hardware flash via CameraManager.setTorchMode() — no camera preview, no
 * browser, no auth session required.
 */
public class TorchForegroundService extends Service {

    private static final String TAG = "VelichamTorch";

    public static final String ACTION_START = "com.velicham.tharaam.START";
    public static final String ACTION_STOP = "com.velicham.tharaam.STOP";
    public static final String EXTRA_COMMUNITY = "community";

    private static final String CHANNEL_ID = "torch_signal_service";
    private static final int NOTIF_ID = 4201;
    private static final long AUTO_OFF_MS = 10L * 60L * 1000L; // safety: torch auto-off after 10 min
    private static final long POLL_MS = 2500L;
    private static final long WINDOW_MS = 10L * 60L * 1000L;

    // Public client config (embedded in the web app as well).
    private static final String API_KEY = "AIzaSyAnoDdt5S8ZBXa7CsQ_vDoeyfz9e2LS8VU";
    private static final String PROJECT_ID = "velicham-tharaam-ad249";

    public static volatile boolean foregroundApp = false;
    private static AtomicBoolean alive = new AtomicBoolean(false);

    private static volatile String sLastAction = "idle";
    private static volatile String sLastError = "";
    private static volatile boolean sTorchOn = false;
    private static volatile long sLastEventAt = 0L;

    private HandlerThread thread;
    private Handler handler;
    private PowerManager.WakeLock wakeLock;
    private CameraManager cameraManager;
    private String flashCameraId = null;
    private volatile boolean hardwareTorchOn = false;
    private volatile boolean pendingSolidOn = false;

    private final Set<String> processedIds = new HashSet<>();
    private long lastSeenMs = 0L;
    private long lastSolidAt = 0L;
    private volatile String communityFilter = "kakkanad";
    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            if (!alive.get()) return;
            try {
                pollOnce();
            } catch (Exception e) {
                Log.w(TAG, "poll error", e);
            }
            keepCpuAwake();
            handler.postDelayed(this, POLL_MS);
        }
    };

    public static boolean isRunning() {
        return alive.get();
    }

    public static String status() {
        return "action=" + sLastAction + " torchOn=" + sTorchOn + " err='" + sLastError + "'";
    }

    public static String lastAction() { return sLastAction; }

    public static String lastError() { return sLastError; }

    public static boolean torchState() { return sTorchOn; }

    @Override
    public void onCreate() {
        super.onCreate();
        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);
        flashCameraId = findFlashCamera();
        restoreState();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "velicham:torchservice");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        if (ACTION_STOP.equals(intent.getAction())) {
            stopEverything();
            return START_NOT_STICKY;
        }
        if (intent.hasExtra(EXTRA_COMMUNITY)) {
            communityFilter = intent.getStringExtra(EXTRA_COMMUNITY);
            getPrefs().edit().putString("community", communityFilter).apply();
        }
        startForegroundCompat();
        ensurePolling();
        return START_STICKY;
    }

    private SharedPreferences getPrefs() {
        return getSharedPreferences("torch_service", MODE_PRIVATE);
    }

    private void restoreState() {
        communityFilter = getPrefs().getString("community", "kakkanad");
        lastSeenMs = getPrefs().getLong("lastSeenMs", System.currentTimeMillis() - WINDOW_MS);
        Set<String> saved = getPrefs().getStringSet("processed", new HashSet<>());
        processedIds.clear();
        if (saved != null) processedIds.addAll(saved);
    }

    private void startForegroundCompat() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Torch Signal Service", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Listening for community torch signals");
        nm.createNotificationChannel(channel);

        Intent tap = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, tap,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notif = new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_torch)
                .setContentTitle("Velicham Tharaam")
                .setContentText("Listening for torch signals • " + communityFilter)
                .setOngoing(true)
                .setContentIntent(pi)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    : android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC;
            startForeground(NOTIF_ID, notif, type);
        } else {
            startForeground(NOTIF_ID, notif);
        }
    }

    private void ensurePolling() {
        if (thread != null) return;
        if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        alive.set(true);
        thread = new HandlerThread("torch-poll");
        thread.start();
        handler = new Handler(thread.getLooper());
        handler.post(poll);
    }

    private void keepCpuAwake() {
        if (wakeLock != null) {
            try {
                wakeLock.release();
                wakeLock.acquire(10L * 60L * 1000L);
            } catch (Exception ignored) {
            }
        }
    }

    private void stopEverything() {
        alive.set(false);
        torchOff();
        if (handler != null) handler.removeCallbacksAndMessages(null);
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopEverything();
        if (thread != null) {
            thread.quitSafely();
            thread = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // ------------------------------------------------------------------
    // Firestore polling
    // ------------------------------------------------------------------

    private void pollOnce() throws Exception {
        long threshold = Math.max(lastSeenMs, System.currentTimeMillis() - WINDOW_MS);
        JSONObject body = new JSONObject();
        JSONObject structured = new JSONObject();
        structured.put("from", new JSONArray().put(new JSONObject().put("collectionId", "torchEvents")));

        JSONObject where = new JSONObject();
        JSONObject fieldFilter = new JSONObject();
        JSONObject field = new JSONObject().put("fieldPath", "createdAt");
        fieldFilter.put("field", field);
        fieldFilter.put("op", "GREATER_THAN_OR_EQUAL");
        fieldFilter.put("value", new JSONObject().put("integerValue", Long.toString(threshold)));
        where.put("fieldFilter", fieldFilter);
        structured.put("where", where);

        JSONArray orderBy = new JSONArray();
        JSONObject ordering = new JSONObject();
        ordering.put("field", field);
        ordering.put("direction", "DESCENDING");
        orderBy.put(ordering);
        structured.put("orderBy", orderBy);
        structured.put("limit", 60);
        body.put("structuredQuery", structured);

        String url = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID
                + "/databases/(default)/documents:runQuery?key=" + API_KEY;

        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(4000);
        conn.setReadTimeout(4000);
        conn.getOutputStream().write(body.toString().getBytes(StandardCharsets.UTF_8));

        int code = conn.getResponseCode();
        if (code != 200 && code != 404) {
            Log.w(TAG, "runQuery HTTP " + code);
            conn.disconnect();
            return;
        }
        InputStream stream = code == 200 ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();

        JSONArray results = new JSONArray(sb.toString());
        long newestSeen = lastSeenMs;
        for (int i = 0; i < results.length(); i++) {
            JSONObject doc = results.optJSONObject(i);
            if (doc == null || !doc.has("document")) continue;
            JSONObject fields = doc.getJSONObject("document").optJSONObject("fields");
            if (fields == null) continue;
            TorchEventView ev = TorchEventView.fromJson(fields);
            if (ev == null) continue;
            newestSeen = Math.max(newestSeen, ev.createdAt);
            if (ev.createdAt < lastSeenMs || processedIds.contains(ev.id)) continue;
            processedIds.add(ev.id);
            if (!matchesCommunity(ev.communityId)) continue;
            handleEvent(ev);
        }
        if (newestSeen > lastSeenMs) {
            lastSeenMs = newestSeen;
            getPrefs().edit().putLong("lastSeenMs", lastSeenMs).apply();
        }
        trimProcessed();
        getPrefs().edit().putStringSet("processed", new HashSet<>(processedIds)).apply();

        if (pendingSolidOn && !hardwareTorchOn && !foregroundApp) {
            if (torchOn()) pendingSolidOn = false;
        }

        if (hardwareTorchOn && System.currentTimeMillis() - lastSolidAt > AUTO_OFF_MS) {
            torchOff();
        }
    }

    private boolean matchesCommunity(String eventCommunity) {
        if (eventCommunity == null) return true;
        String e = eventCommunity.trim().toLowerCase();
        String c = communityFilter.trim().toLowerCase();
        return e.equals("all") || e.equals("global") || e.isEmpty() || e.equals(c);
    }

    private void handleEvent(TorchEventView ev) {
        sLastEventAt = ev.createdAt;
        sLastAction = ev.action == null ? "SOLID_ON" : ev.action;
        if (ev.communityId != null && !ev.communityId.isEmpty()) {
            sLastAction += "[" + ev.communityId + "]";
        }
        sLastError = "";

        if (foregroundApp) {
            // WebView is active — let the web layer flash the screen/torch.
            if ("TORCH_OFF".equals(ev.action)) torchOff();
            return;
        }
        String action = ev.action == null ? "SOLID_ON" : ev.action;
        if ("TORCH_OFF".equals(action)) {
            pendingSolidOn = false;
            torchOff();
            return;
        }
        String pattern = ev.pattern == null ? "3_BLINKS" : ev.pattern;
        if ("3_BLINKS".equals(pattern) || "BLINK_THEN_ON".equals(action)) {
            blinkThenSolid();
        } else {
            if (!torchOn()) pendingSolidOn = true;
        }
    }

    // ------------------------------------------------------------------
    // Hardware torch
    // ------------------------------------------------------------------

    private String findFlashCamera() {
        try {
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics ch = cameraManager.getCameraCharacteristics(id);
                Boolean flash = ch.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer facing = ch.get(CameraCharacteristics.LENS_FACING);
                if (Boolean.TRUE.equals(flash)
                        && (facing == null || facing == CameraCharacteristics.LENS_FACING_BACK)) {
                    return id;
                }
                if (Boolean.TRUE.equals(flash)) return id;
            }
        } catch (Exception e) {
            Log.w(TAG, "no flash camera: " + e.getMessage());
        }
        return null;
    }

    private boolean torchOn() {
        if (flashCameraId == null) {
            sLastError = "no flash camera found";
            return false;
        }
        if (hardwareTorchOn) return true;
        try {
            cameraManager.setTorchMode(flashCameraId, true);
            hardwareTorchOn = true;
            sTorchOn = true;
            lastSolidAt = System.currentTimeMillis();
            sLastError = "";
            return true;
        } catch (Exception e) {
            sLastError = e.getMessage();
            Log.w(TAG, "torchOn failed: " + e.getMessage());
            return false;
        }
    }

    private void torchOff() {
        pendingSolidOn = false;
        if (flashCameraId == null) return;
        try {
            cameraManager.setTorchMode(flashCameraId, false);
        } catch (Exception ignored) {
        }
        hardwareTorchOn = false;
        sTorchOn = false;
    }

    private void blinkThenSolid() {
        if (!torchOn()) {
            pendingSolidOn = true;
            return;
        }
        try {
            for (int i = 0; i < 3 && alive.get(); i++) {
                Thread.sleep(450);
                torchOff();
                Thread.sleep(220);
                if (!torchOn()) {
                    pendingSolidOn = true;
                    return;
                }
            }
        } catch (InterruptedException ignored) {
        }
        if (alive.get() && !foregroundApp) torchOn();
    }

    private void trimProcessed() {
        if (processedIds.size() > 300) {
            java.util.Iterator<String> it = processedIds.iterator();
            int drop = processedIds.size() - 150;
            while (drop-- > 0 && it.hasNext()) {
                it.next();
                it.remove();
            }
        }
    }

    private static class TorchEventView {
        final String id;
        final String communityId;
        final String action;
        final String pattern;
        final long createdAt;

        TorchEventView(String id, String communityId, String action, String pattern, long createdAt) {
            this.id = id;
            this.communityId = communityId;
            this.action = action;
            this.pattern = pattern;
            this.createdAt = createdAt;
        }

        static TorchEventView fromJson(JSONObject fields) {
            try {
                long createdAt = -1;
                JSONObject ca = fields.optJSONObject("createdAt");
                if (ca != null) {
                    if (ca.has("integerValue")) createdAt = Long.parseLong(ca.getString("integerValue"));
                    else if (ca.has("timestampValue")) createdAt = parseTimestamp(ca.getString("timestampValue"));
                }
                if (createdAt < 0) return null;
                String id = str(fields, "id");
                if (id == null) return null;
                return new TorchEventView(
                        id,
                        str(fields, "communityId"),
                        str(fields, "action"),
                        str(fields, "pattern"),
                        createdAt);
            } catch (Exception e) {
                return null;
            }
        }

        private static String str(JSONObject fields, String key) {
            JSONObject v = fields.optJSONObject(key);
            if (v == null) return null;
            if (v.has("stringValue")) return v.optString("stringValue");
            return null;
        }

        private static final java.text.SimpleDateFormat TS_MS =
                new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", java.util.Locale.US);
        private static final java.text.SimpleDateFormat TS_S =
                new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US);

        private static long parseTimestamp(String ts) {
            try {
                String t = ts.endsWith("Z") ? ts.substring(0, ts.length() - 1) + "+00:00" : ts;
                try {
                    return TS_MS.parse(t).getTime();
                } catch (Exception ignored) {
                    return TS_S.parse(t).getTime();
                }
            } catch (Exception e) {
                return -1;
            }
        }
    }
}