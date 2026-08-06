package com.mylifeos.app.shield.vision;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.lang.reflect.Type;
import java.util.HashSet;
import java.util.Set;

// ─────────────────────────────────────────────────────────────────────────────
// PureShieldConfig — All runtime settings for the vision feature
// ─────────────────────────────────────────────────────────────────────────────
public class PureShieldConfig {

    public enum BlurGender { FEMALE, MALE, BOTH }

    private BlurGender blurGender         = BlurGender.BOTH;
    private PureShieldBlurView.BlurStyle blurStyle = PureShieldBlurView.BlurStyle.PIXELATE;
    private float confidenceThreshold = 0.40f;
    private int blurOpacity               = 100;
    private int blurPaddingPct            = 15;
    private int minFaceSizePct            = 2;
    private int maxFaces                  = 100;
    private boolean debugOverlay          = false;
    private boolean enabled               = true;
    private boolean pauseOnBatteryBelow20 = true;
    private boolean showShieldIcon        = true;

    public PureShieldConfig() {}

    public BlurGender getBlurGender()                          { return blurGender; }
    public PureShieldBlurView.BlurStyle getBlurStyle()         { return blurStyle; }
    public float getConfidenceThreshold()                      { return confidenceThreshold; }
    public int getBlurOpacity()                                { return blurOpacity; }
    public int getBlurPaddingPct()                             { return blurPaddingPct; }
    public int getMinFaceSizePct()                             { return minFaceSizePct; }
    public int getMaxFaces()                                   { return maxFaces; }
    public boolean isDebugOverlay()                            { return debugOverlay; }
    public boolean isEnabled()                                 { return enabled; }
    public boolean isPauseOnBatteryBelow20()                   { return pauseOnBatteryBelow20; }
    public boolean isShowShieldIcon()                          { return showShieldIcon; }

    public void setBlurGender(BlurGender g)                    { this.blurGender = g; }
    public void setBlurStyle(PureShieldBlurView.BlurStyle s)   { this.blurStyle = s; }
    public void setConfidenceThreshold(float t)                { this.confidenceThreshold = t; }
    public void setBlurOpacity(int o)                          { this.blurOpacity = Math.max(20, Math.min(100, o)); }
    public void setBlurPaddingPct(int p)                       { this.blurPaddingPct = Math.max(0, Math.min(80, p)); }
    public void setMinFaceSizePct(int p)                       { this.minFaceSizePct = Math.max(1, Math.min(30, p)); }
    public void setMaxFaces(int m)                              { this.maxFaces = Math.max(1, Math.min(100, m)); }
    public void setDebugOverlay(boolean d)                     { this.debugOverlay = d; }
    public void setEnabled(boolean e)                          { this.enabled = e; }
    public void setPauseOnBatteryBelow20(boolean p)            { this.pauseOnBatteryBelow20 = p; }
    public void setShowShieldIcon(boolean s)                   { this.showShieldIcon = s; }
}
