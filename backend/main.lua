-- OneBeigeSteam injector stub.
-- The real backend is the OneBeigeSteam GUI desktop app (HTTP on 127.0.0.1:6767). This lua
-- backend has two jobs:
--   1. Put onebeegsteam.js onto the Steam store webkit context (copy into steamui/webkit +
--      Millennium.add_browser_js) — delivery is backend-only in Millennium.
--   2. Be the RPC bridge between the injected page and the app. onebeegsteam.js calls
--      window.Millennium.callServerMethod("onebeegsteam", "<Name>", args) — under real
--      Millennium that dispatches here (Millennium looks up a GLOBAL Lua function named
--      exactly "<Name>", NOT a member of the table this file returns — see
--      lua_host/main.cc's handle_evaluate). Each RPC function below just relays to the
--      app's HTTP API using Millennium's own http module (server-side, so — unlike a
--      page-context fetch() — it isn't subject to the browser's mixed-content blocking).
--
-- The non-Millennium ("LuaLoader") install mode has its own equivalent bridge:
-- OneBeigeSteam GUI's CefInjectorService, which polls the injected page over CDP and makes
-- the same HTTP calls from the app process itself. Any new RPC method added to
-- onebeegsteam.js needs a handler in BOTH places, or it only works under one loader.

local millennium  = require("millennium")
local fs          = require("fs")
local m_utils     = require("utils")
local logger      = require("plugin_logger")
local paths       = require("paths")
local steam_utils = require("steam_utils")
local http        = require("http")
local cjson       = require("json")

-- ── App backend bridge (127.0.0.1:6767) ────────────────────────────────────────

local BACKEND_BASE = "http://127.0.0.1:6767"

local function backend_request(method, path, body)
    local opts = { method = method, timeout = 15 }
    if body then
        opts.data = cjson.encode(body)
        opts.headers = { ["Content-Type"] = "application/json" }
    end
    local response, err = http.request(BACKEND_BASE .. path, opts)
    if not response then
        return cjson.encode({ success = false, error = tostring(err or "request failed") })
    end
    return response.body
end

-- ── Ensure the app is running ──────────────────────────────────────────────────
-- Mirrors what the non-Millennium DLL hijack does (launch_onebeegsteam() in
-- steampluginback/src/lib.rs) — that code never runs under Millennium (Millennium owns
-- wsock32.dll instead), so nothing else brings the backend up in this mode.

local function ensure_backend_running()
    local response = http.get(BACKEND_BASE .. "/has/0", { timeout = 2 })
    if response then return end -- already up

    local local_appdata = m_utils.getenv("LOCALAPPDATA")
    if not local_appdata or local_appdata == "" then
        logger.warn("LOCALAPPDATA not available, cannot launch OneBeigeSteam backend")
        return
    end

    local exe_path = local_appdata .. "\\OneBeigeSteam\\current\\OneBeigeSteam.exe"
    if not fs.exists(exe_path) then
        logger.warn("OneBeigeSteam.exe not found at " .. exe_path .. " (not installed?)")
        return
    end

    -- `start` launches detached and returns immediately; utils.exec only blocks on
    -- that, not on OneBeigeSteam.exe itself.
    m_utils.exec('start "" "' .. exe_path .. '" --minimized')
    logger.log("Launched OneBeigeSteam backend: " .. exe_path)
end

-- ── RPC handlers (must be GLOBAL functions — Millennium looks these up by name) ─

function HasOneBeigeSteamForApp(appid)
    return backend_request("GET", "/has/" .. tostring(appid))
end

function DeleteOneBeigeSteamForApp(appid)
    return backend_request("POST", "/remove/" .. tostring(appid))
end

function CheckApisForApp(appid)
    return backend_request("POST", "/check-sources/" .. tostring(appid))
end

function StartAddViaOneBeigeSteamFromUrl(appid, source)
    return backend_request("POST", "/download/" .. tostring(appid), { source = source })
end

function GetAddViaOneBeigeSteamStatus(appid)
    return backend_request("GET", "/download-status/" .. tostring(appid))
end

function CancelAddViaOneBeigeSteam(appid)
    return backend_request("POST", "/cancel/" .. tostring(appid))
end

function RestartSteam()
    return backend_request("POST", "/restart-steam")
end

function StartOneBeigeSteamAdd(appid)
    return backend_request("POST", "/add/" .. tostring(appid))
end

function GetOneBeigeSteamAddStatus(appid)
    return backend_request("GET", "/add-status/" .. tostring(appid))
end

function PickOneBeigeSteamAddSource(appid, source)
    return backend_request("POST", "/add-source/" .. tostring(appid), { source = source })
end

function OpenSettings()
    return backend_request("POST", "/open/settings")
end

function OpenFix(appid)
    return backend_request("POST", "/open/fix/" .. tostring(appid))
end

-- "Games added since last Steam restart" popup: read the list, then dismiss it.
function ReadLoadedApps()
    return backend_request("GET", "/loaded-apps")
end

function DismissLoadedApps()
    return backend_request("POST", "/loaded-apps")
end

-- ── Webkit file management (lifted verbatim from the old backend) ─────────────

local function copy_webkit_files()
    local steam_dir = steam_utils.detect_steam_install_path()
    if not steam_dir or steam_dir == "" then return end

    local target_webkit_dir = fs.join(steam_dir, "steamui", "webkit")
    if not fs.exists(target_webkit_dir) then
        fs.create_directories(target_webkit_dir)
    end

    local public_dir = fs.join(paths.get_plugin_dir(), "public")

    local src_js = fs.join(public_dir, "onebeegsteam.js")
    local dst_js = fs.join(target_webkit_dir, "onebeegsteam.js")
    if fs.exists(src_js) then
        local content = m_utils.read_file(src_js)
        if content then m_utils.write_file(dst_js, content) end
    end

    local src_css = fs.join(public_dir, "steamdb-webkit.css")
    local dst_css = fs.join(target_webkit_dir, "steamdb-webkit.css")
    if fs.exists(src_css) then
        local content = m_utils.read_file(src_css)
        if content then m_utils.write_file(dst_css, content) end
    end
end

local function inject_webkit_files()
    millennium.add_browser_css("webkit/steamdb-webkit.css")
    millennium.add_browser_js("webkit/onebeegsteam.js")
end

-- ── Lifecycle ────────────────────────────────────────────────────────────────

local function on_load()
    logger.log("OneBeigeSteam injector stub loading (millennium " .. tostring(millennium.version()) .. ")")
    ensure_backend_running()
    copy_webkit_files()
    inject_webkit_files()
    millennium.ready()
end

local function on_unload()
    logger.log("OneBeigeSteam injector stub unloading")
end

local function on_frontend_loaded()
    -- Re-copy so an updated onebeegsteam.js is picked up without a manual step.
    copy_webkit_files()
end

return {
    on_load            = on_load,
    on_unload          = on_unload,
    on_frontend_loaded = on_frontend_loaded,
}
