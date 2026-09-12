package com.velicham.tharaam;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name = "BackgroundTorch", permissions = {
        @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class TorchPlugin extends Plugin {

    private PluginCall pendingCall;

    @PluginMethod
    public void start(PluginCall call) {
        String communityId = call.getString("communityId", "kakkanad");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            pendingCall = call;
            requestPermissionForAlias("notifications", call, "permissionGranted");
            return;
        }
        doStart(communityId);
        call.resolve();
    }

    @PermissionCallback
    private void permissionGranted(PluginCall call) {
        String communityId = pendingCall != null && pendingCall.getData() != null
                ? pendingCall.getString("communityId", "kakkanad")
                : "kakkanad";
        doStart(communityId);
        if (pendingCall != null) {
            pendingCall.resolve();
            pendingCall = null;
        }
    }

    private void doStart(String communityId) {
        Intent intent = new Intent(getContext(), TorchForegroundService.class);
        intent.setAction(TorchForegroundService.ACTION_START);
        intent.putExtra(TorchForegroundService.EXTRA_COMMUNITY, communityId);
        ContextCompat.startForegroundService(getContext(), intent);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), TorchForegroundService.class);
        intent.setAction(TorchForegroundService.ACTION_STOP);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void setForeground(PluginCall call) {
        Boolean fg = call.getBoolean("foreground", false);
        TorchForegroundService.foregroundApp = fg != null && fg;
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", TorchForegroundService.isRunning());
        call.resolve(result);
    }
}