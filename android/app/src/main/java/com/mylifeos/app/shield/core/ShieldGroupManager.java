package com.mylifeos.app.shield.core;

import android.content.Context;
import android.content.SharedPreferences;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ShieldGroupManager {
    private static final String PREF_GROUPS = "shield_groups";
    private static final String KEY_GROUP_LIST = "group_list";
    private static final String KEY_CURRENT_GROUP = "current_group";
    
    private final SharedPreferences prefs;
    private final Gson gson;

    public ShieldGroupManager(Context context) {
        prefs = context.getSharedPreferences(PREF_GROUPS, Context.MODE_PRIVATE);
        gson = new Gson();
    }

    public void createGroup(String groupId, String groupName, List<String> members) {
        Map<String, Object> group = new HashMap<>();
        group.put("id", groupId);
        group.put("name", groupName);
        group.put("members", members);
        group.put("createdAt", System.currentTimeMillis());
        
        List<Map<String, Object>> groups = getAllGroups();
        groups.add(group);
        saveGroups(groups);
    }

    public void joinGroup(String groupId) {
        prefs.edit().putString(KEY_CURRENT_GROUP, groupId).apply();
    }

    public void leaveGroup() {
        prefs.edit().remove(KEY_CURRENT_GROUP).apply();
    }

    public String getCurrentGroupId() {
        return prefs.getString(KEY_CURRENT_GROUP, null);
    }

    public List<Map<String, Object>> getAllGroups() {
        String json = prefs.getString(KEY_GROUP_LIST, "[]");
        Type type = new TypeToken<ArrayList<Map<String, Object>>>(){}.getType();
        List<Map<String, Object>> list = gson.fromJson(json, type);
        return list != null ? list : new ArrayList<>();
    }

    private void saveGroups(List<Map<String, Object>> groups) {
        String json = gson.toJson(groups);
        prefs.edit().putString(KEY_GROUP_LIST, json).apply();
    }

    public void deleteGroup(String groupId) {
        List<Map<String, Object>> groups = getAllGroups();
        groups.removeIf(g -> groupId.equals(g.get("id")));
        saveGroups(groups);
        
        if (groupId.equals(getCurrentGroupId())) {
            leaveGroup();
        }
    }
}