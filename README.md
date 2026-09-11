# VELICHAM THARAAM 🔦
> **“Current poyaalum, nammal velicham tharaam.”**

A civic-tech hackathon MVP that turns smartphones into a decentralized emergency lighting network during Kerala power cuts.

---

## ⚡ Problem & Solution

* **Problem:** When electricity goes out, residents don't know whether the outage is only in their house (blown fuse / trip switch) or across the locality (transformer / substation fault).
* **Solution:** 
  1. Nearby residents tap **🔴 CURRENT POYI**.
  2. Distinct reports within a 5-minute sliding window trigger **Realtime Consensus**.
  3. Once confirmed (e.g. 3 residents), the system verifies the outage.
  4. Connected smartphones execute a synchronized physical flashlight signal: **Blink × 3 (400ms) → Solid ON**.
  5. When power returns, residents tap **🟢 CURRENT VANNU** or the KSEB Controller restores power → **All flashlights turn OFF**.

---

## 🛠 Tech Stack

* **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
* **Mapping:** Leaflet + OpenStreetMap (Kerala / Ernakulam focus)
* **Realtime & Auth:** Firebase Authentication + Firestore / Realtime Database + Multi-tab BroadcastChannel sync
* **Flashlight / Torch:** Web MediaStream API (`navigator.mediaDevices.getUserMedia` with `advanced: [{ torch: true }]`) + high-candela screen beacon fallback
* **Audio Synthesis:** Web Audio API synth tones for emergency alerts and restoration chimes
* **Icons:** Lucide React

---

## 🚀 Quick Start

### 1. Install & Run Dev Server

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on your browser or phone on the same local network (`http://<YOUR_IP>:5173`).

---

## 📱 Hackathon Presentation Demo Script

### Quick Demo Switcher (Top of UI)
The top switcher lets you instantly switch between demo personas:
- **Resident A (Rahul)** - House #12
- **Resident B (Anjali)** - Apt 4B
- **Resident C (Faizal)** - Shop 1
- **⚡ Controller** - KSEB Area Dispatcher

### Live 3-Phone Presentation Flow
1. Open the app on **3 Android phones** or 3 browser windows.
2. Ensure they are in the same community (e.g. **Kakkanad**).
3. Tap **Enable Flashlight** on the phones.
4. **Phone A:** Tap **🔴 CURRENT POYI** → consensus meter shows `1 / 3`.
5. **Phone B:** Tap **🔴 CURRENT POYI** → consensus meter shows `2 / 3`.
6. **Phone C:** Tap **🔴 CURRENT POYI** → consensus meter hits `3 / 3`!
7. **💥 Magic Moment:**
   - Outage is **VERIFIED**.
   - Sound alert plays.
   - All connected phones physically **Blink 3 times (400ms) and stay Solid ON**!
8. Tap **🟢 CURRENT VANNU** or use the **Controller Dashboard** (`Restore Power`) → **All flashlights turn OFF**.

---

## 🔒 Privacy & Torch Safety

* **No camera recordings or photos:** Camera hardware is accessed solely to toggle the rear LED torch via media stream track constraints.
* **No exact GPS:** Coordinates are never gathered or stored; only community-level centroids (Kakkanad, Edappally, Aluva, Vyttila, Kalamassery, Thrippunithura) are mapped.
* **Turn Off Button:** Every screen includes an immediate "Turn Off My Flashlight" override.

---

## 🏛 Firebase Rules & Deployment

Security rules are located at `src/firebase/firestore.rules`.
Configure your `.env` from `.env.example` to attach to your Firebase project.
Even without Firebase API keys, the app runs with full multi-tab realtime synchronization.
