package com.velicham.tharaam;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TorchPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        TorchForegroundService.foregroundApp = false;
    }

    @Override
    public void onResume() {
        super.onResume();
        TorchForegroundService.foregroundApp = true;
    }
}