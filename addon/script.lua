-- StormPower by Aimless Developement
-- Bridge: http://127.0.0.1:21773/sw/poll
-- Chat commands also work (see ?sp)

g_savedata = {
	require_admin = property.checkbox("Require admin", false),
}

local PORT = 21773
local POLL_EVERY = 4
local tick_counter = 0
local spawned = {}
local weather_fog = 0
local weather_rain = 0
local weather_wind = 0
-- sea_mode: 0 = off, 1 = weather waves only, 2 = weather + repeating mega wave events
local sea_mode = 0
local tsunami_timer = 0
local tsunami_angle = 0
local TSUNAMI_INTERVAL = 180 -- refresh epicenter often (engine allows only ONE at a time)
local sirens_muted = true -- default mute; disasters addon re-triggers them
local tracked_sirens = {}
local siren_refresh = 0

-- Session defaults for chat commands
local session = {
	count = 5,
	size = 1,
	dist = 20,
}

local function announce(peer_id, msg)
	server.announce("StormPower", msg, peer_id or -1)
end

local function notify(peer_id, msg)
	if peer_id and peer_id >= 0 then
		server.notify(peer_id, "StormPower", msg, 8)
	end
end

local function track(kind, id)
	spawned[#spawned + 1] = { kind = kind, id = id }
end

local function split(str, sep)
	local out = {}
	for part in string.gmatch(str, "([^" .. sep .. "]+)") do
		out[#out + 1] = part
	end
	return out
end

local function num(v, default)
	local n = tonumber(v)
	if n == nil then return default end
	return n
end

local function frontMatrix(peer_id, distance, y_offset)
	y_offset = y_offset or 0
	distance = distance or 20
	local pos, ok = server.getPlayerPos(peer_id)
	if not ok then return nil end
	local lx, ly, lz, lok = server.getPlayerLookDirection(peer_id)
	if not lok then lx, ly, lz = 0, 0, 1 end
	local len = math.sqrt(lx * lx + lz * lz)
	if len < 0.001 then lx, lz = 0, 1 else lx, lz = lx / len, lz / len end
	return matrix.translation(pos[13] + lx * distance, pos[14] + y_offset, pos[15] + lz * distance)
end

local function getCharacter(peer_id)
	local char_id, ok = server.getPlayerCharacterID(peer_id)
	if ok then return char_id end
	return nil
end

local function resolvePeer(peer_id)
	local players = server.getPlayers()
	for i = 1, #players do
		if players[i].id == peer_id then return peer_id end
	end
	if players[1] then return players[1].id end
	return 0
end

local function cleanup(peer_id)
	local n = 0
	for i = #spawned, 1, -1 do
		local e = spawned[i]
		if e.kind == "object" and server.despawnObject(e.id, true) then n = n + 1 end
		if e.kind == "vehicle" and server.despawnVehicle(e.id, true) then n = n + 1 end
		spawned[i] = nil
	end
	notify(peer_id, "Cleaned " .. n)
end

local function setWeatherState(fog, rain, wind)
	weather_fog = fog
	weather_rain = rain
	-- Waves ONLY respond to wind in 0-1. Values above 1 do not make bigger waves.
	weather_wind = math.max(0, math.min(1, wind))
	server.setWeather(weather_fog, weather_rain, weather_wind)
end

local function silenceSirens()
	local n = 0
	-- Known disaster-siren keypad: "state" 0 = off (from Default Natural Disasters)
	for id, _ in pairs(tracked_sirens) do
		if server.setVehicleKeypad(id, "state", 0) then
			n = n + 1
		end
	end
	-- Also try by name in case we missed tracking
	local by_name, ok = server.getVehiclesByName("default_siren")
	if ok and by_name then
		for _, id in pairs(by_name) do
			tracked_sirens[id] = true
			if server.setVehicleKeypad(id, "state", 0) then
				n = n + 1
			end
		end
	end
	-- Calm player audio mood (disaster music / tension)
	server.setAudioMood(-1, 0)
	return n
end

local function enableSirens()
	local n = 0
	for id, _ in pairs(tracked_sirens) do
		if server.setVehicleKeypad(id, "state", 1) then
			n = n + 1
		end
	end
	server.setAudioMood(-1, 2)
	return n
end

local function spawnMegaWaveNear(peer_id)
	-- Engine hard-limit: only ONE tsunami/whirlpool (gerstner event) can exist.
	-- Stronger events override weaker ones. We rotate the epicenter around the
	-- player each refresh to simulate multi-directional massive seas.
	local pos, ok = server.getPlayerPos(peer_id)
	if not ok then
		return false
	end
	tsunami_angle = tsunami_angle + 1.1
	local radius = 120 + (tsunami_angle % 3) * 80
	local x = pos[13] + math.cos(tsunami_angle) * radius
	local z = pos[15] + math.sin(tsunami_angle) * radius
	local mat = matrix.translation(x, 0, z)
	-- Always magnitude 1 so each refresh overrides the previous
	server.spawnTsunami(mat, 1.0)
	if sirens_muted then
		silenceSirens()
	end
	return true
end

local function runCommand(line)
	if not line or line == "" or line == "NONE" then return end
	if string.find(line, "connect()", 1, true) or string.find(line, "Connection refused", 1, true) then
		return
	end
	-- Ignore legacy multiplex UI payloads if any
	if string.find(line, "\n---\n", 1, true) then
		line = string.match(line, "^(.-)\n%-%-%-") or line
	end

	local p = split(line, "|")
	local cmd = p[1]
	local peer_id = resolvePeer(math.floor(num(p[2], 0)))

	if cmd == "spawn_animal" then
		local id = math.floor(num(p[3], 0))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local size = math.max(0.1, num(p[5], 1))
		local dist = math.max(1, math.min(5000, num(p[6], 20)))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 4, -2)
			if mat then
				local oid, ok = server.spawnAnimal(mat, id, size)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")

	elseif cmd == "spawn_creature" then
		local id = math.floor(num(p[3], 0))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local size = math.max(0.1, num(p[5], 1))
		local dist = math.max(1, math.min(5000, num(p[6], 20)))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 3, 0)
			if mat then
				local oid, ok = server.spawnCreature(mat, id, size)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		if n == 0 then
			announce(peer_id, "Creature spawn failed (Industrial Frontier DLC?)")
		else
			notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")
		end

	elseif cmd == "spawn_object" then
		local id = math.floor(num(p[3], 2))
		local count = math.max(1, math.floor(num(p[4], 1)))
		local dist = math.max(1, math.min(5000, num(p[5], 20)))
		local n = 0
		for i = 1, count do
			local mat = frontMatrix(peer_id, dist + (i - 1) * 2, 1)
			if mat then
				local oid, ok = server.spawnObject(mat, id)
				if ok then track("object", oid); n = n + 1 end
			end
		end
		notify(peer_id, "Spawned " .. n .. " @ " .. dist .. "m")

	elseif cmd == "give" then
		local equip = math.floor(num(p[3], 0))
		local slot = math.floor(num(p[4], 2))
		local int_v = math.floor(num(p[5], 0))
		local float_v = num(p[6], 0)
		local char_id = getCharacter(peer_id)
		if char_id and server.setCharacterItem(char_id, slot, equip, true, int_v, float_v) then
			notify(peer_id, "Item added")
		else
			announce(peer_id, "Give failed (Weapons DLC?)")
		end

	elseif cmd == "outfit" then
		local outfit = math.floor(num(p[3], 0))
		local char_id = getCharacter(peer_id)
		if char_id and server.setCharacterItem(char_id, 10, outfit, true, 1, 0) then
			notify(peer_id, "Outfit equipped")
		end

	elseif cmd == "c4_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 2, 31, true, 4, 0)
			server.setCharacterItem(char_id, 3, 32, true, 0, 0)
			notify(peer_id, "C4 kit given")
		end

	elseif cmd == "spear_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 1, 33, true, 5, 0)
			server.setCharacterItem(char_id, 2, 34, true, 10, 0)
			notify(peer_id, "Speargun kit given")
		end

	elseif cmd == "disaster" then
		local kind = p[3] or "tsunami"
		local dist = math.max(40, math.min(5000, num(p[4], 80)))
		local mat = frontMatrix(peer_id, dist, 0)
		if mat then
			if kind == "tsunami" then server.spawnTsunami(mat, 0.7)
			elseif kind == "whirlpool" then server.spawnWhirlpool(mat, 0.7)
			elseif kind == "tornado" then server.spawnTornado(mat)
			elseif kind == "meteor" then server.spawnMeteor(mat, 0.6, false)
			elseif kind == "shower" then server.spawnMeteorShower(mat, 0.6, false)
			elseif kind == "volcano" then server.spawnVolcano(mat)
			end
			notify(peer_id, "Disaster spawned")
		end

	elseif cmd == "weather" then
		local fog = num(p[3], 0)
		local rain = num(p[4], 0)
		local wind = num(p[5], 0)
		sea_mode = 0
		server.cancelGerstner()
		setWeatherState(fog, rain, wind)
		notify(peer_id, string.format("Weather set (wave wind %.2f)", weather_wind))

	elseif cmd == "sea" then
		-- mode 0 calm, 1 weather waves, 2 massive (weather + tsunami loop)
		local mode = math.floor(num(p[3], 0))
		local wind = num(p[4], 1)
		sea_mode = mode
		tsunami_timer = 0
		if mode <= 0 then
			server.cancelGerstner()
			setWeatherState(weather_fog, weather_rain, 0)
			notify(peer_id, "Seas calmed")
			announce(peer_id, "Wave mode OFF")
		else
			setWeatherState(weather_fog, weather_rain, wind)
			if mode >= 2 then
				sirens_muted = true
				silenceSirens()
				spawnMegaWaveNear(peer_id)
				notify(peer_id, "MASSIVE WAVES ON (sirens muted)")
				announce(peer_id, "Massive waves on. Game only allows 1 tsunami at a time — StormPower rotates the epicenter. Deep ocean (300m+) is best.")
			else
				server.cancelGerstner()
				notify(peer_id, string.format("Sea state ON (wind %.2f)", weather_wind))
				announce(peer_id, "Weather waves active. Deep ocean (300m+) makes the tallest waves.")
			end
		end

	elseif cmd == "mega_wave" then
		if spawnMegaWaveNear(peer_id) then
			setWeatherState(weather_fog, weather_rain, 1)
			if sirens_muted then silenceSirens() end
			notify(peer_id, "Mega wave spawned")
		else
			announce(peer_id, "Could not spawn mega wave")
		end

	elseif cmd == "sirens" then
		local mode = tostring(p[3] or "off")
		if mode == "on" or mode == "1" then
			sirens_muted = false
			local n = enableSirens()
			notify(peer_id, "Sirens enabled (" .. n .. ")")
		else
			sirens_muted = true
			local n = silenceSirens()
			notify(peer_id, "Sirens muted (" .. n .. " towers)")
			announce(peer_id, "Disaster sirens forced OFF. They will stay muted while StormPower is running.")
		end

	elseif cmd == "wind_boost" then
		-- Legacy: map to sea modes. Values >1 become MASSIVE mode.
		local wind = num(p[3], 0)
		if wind <= 0 then
			runCommand("sea|" .. peer_id .. "|0|0")
		elseif wind <= 1 then
			runCommand("sea|" .. peer_id .. "|1|" .. tostring(wind))
		else
			runCommand("sea|" .. peer_id .. "|2|1")
		end

	elseif cmd == "heal" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.reviveCharacter(char_id)
			server.setCharacterData(char_id, 100, true, false)
			notify(peer_id, "Healed")
		end

	elseif cmd == "clear_inv" then
		local char_id = getCharacter(peer_id)
		if char_id then
			for slot = 1, 10 do server.setCharacterItem(char_id, slot, 0, false, 0, 0) end
			notify(peer_id, "Inventory cleared")
		end

	elseif cmd == "loadout" then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setCharacterItem(char_id, 1, 39, true, 30, 0)
			server.setCharacterItem(char_id, 2, 40, true, 60, 0)
			server.setCharacterItem(char_id, 3, 41, true, 5, 0)
			server.setCharacterItem(char_id, 4, 11, true, 4, 0)
			server.setCharacterItem(char_id, 5, 31, true, 4, 0)
			server.setCharacterItem(char_id, 6, 32, true, 0, 0)
			server.setCharacterItem(char_id, 10, 78, true, 0, 0)
			notify(peer_id, "Loadout ready")
		end

	elseif cmd == "money" then
		local money = server.getCurrency()
		local research = server.getResearchPoints()
		server.setCurrency(money + 100000, research)
		notify(peer_id, "+$100000")

	elseif cmd == "cleanup" then
		cleanup(peer_id)

	elseif cmd == "setting" then
		local key = p[3]
		local value = num(p[4], 0) ~= 0
		if key and key ~= "" then
			server.setGameSetting(key, value)
			announce(peer_id, key .. " = " .. tostring(value))
		end
	end
end

local function help(peer_id)
	announce(peer_id, "=== StormPower Commands ===")
	announce(peer_id, "?sp                 This help")
	announce(peer_id, "?dist <m>           Set spawn distance (1-5000)")
	announce(peer_id, "?count <n>          Set spawn amount")
	announce(peer_id, "?size <n>           Set scale")
	announce(peer_id, "?shark [n] [size] [dist]")
	announce(peer_id, "?whale [n] [size] [dist]")
	announce(peer_id, "?kraken [n] [size] [dist]")
	announce(peer_id, "?give pistol|smg|rifle|grenade|c4|spear|aid")
	announce(peer_id, "?loadout  ?heal  ?money  ?cleanup")
	announce(peer_id, "?outfit scuba|diving|armor|arctic")
	announce(peer_id, "?waves calm|choppy|max|mega|off")
	announce(peer_id, "?tsunami            One mega wave near you")
	announce(peer_id, "?sirens off|on      Mute / enable disaster sirens")
	announce(peer_id, "?wind <0-10>        Alias (2+ = massive waves)")
	announce(peer_id, "Overlay: click the SP button to show/hide menu")
end

local GIVE = {
	pistol = { 35, 1, 17, 0 },
	smg = { 37, 1, 30, 0 },
	rifle = { 39, 1, 10, 0 },
	grenade = { 41, 2, 3, 0 },
	c4 = { 31, 2, 4, 0 },
	spear = { 33, 1, 5, 0 },
	aid = { 11, 2, 4, 0 },
	flashlight = { 15, 2, 0, 100 },
}

local OUTFITS = {
	diving = 1,
	firefighter = 2,
	scuba = 3,
	parachute = 4,
	arctic = 5,
	hazmat = 29,
	armor = 78,
}

function onCreate(is_world_create)
	spawned = {}
	sea_mode = 0
	weather_wind = 0
	tsunami_timer = 0
	tsunami_angle = 0
	tick_counter = 0
	sirens_muted = true
	tracked_sirens = {}
	-- Discover already-spawned siren towers by name
	local by_name, ok = server.getVehiclesByName("default_siren")
	if ok and by_name then
		for _, id in pairs(by_name) do
			tracked_sirens[id] = true
		end
	end
	silenceSirens()
	announce(-1, "StormPower ready. Sirens muted by default. Type ?sp for commands.")
end

function onTick(game_ticks)
	local gt = game_ticks or 1
	tick_counter = tick_counter + gt
	if tick_counter >= POLL_EVERY then
		tick_counter = 0
		server.httpGet(PORT, "/sw/poll")
	end

	if sea_mode >= 1 then
		server.setWeather(weather_fog, weather_rain, weather_wind)
	end

	-- Keep re-muting: Default Natural Disasters re-triggers sirens on each disaster tick
	if sirens_muted then
		siren_refresh = siren_refresh + gt
		if siren_refresh >= 60 then
			siren_refresh = 0
			silenceSirens()
		end
	end

	-- MASSIVE mode: one gerstner event at a time (engine limit). Rotate epicenter.
	if sea_mode >= 2 then
		tsunami_timer = tsunami_timer + gt
		if tsunami_timer >= TSUNAMI_INTERVAL then
			tsunami_timer = 0
			local players = server.getPlayers()
			local peer = 0
			if players[1] then peer = players[1].id end
			spawnMegaWaveNear(peer)
		end
	end
end

-- Track siren towers as they stream in
function onVehicleLoad(vehicle_id)
	local btn, ok = server.getVehicleButton(vehicle_id, "trigger")
	if ok then
		tracked_sirens[vehicle_id] = true
		if sirens_muted then
			server.setVehicleKeypad(vehicle_id, "state", 0)
		end
	end
end

function onSpawnAddonComponent(id, name, type_string, addon_index)
	if type_string == "vehicle" and name == "default_siren" then
		tracked_sirens[id] = true
		if sirens_muted then
			server.setVehicleKeypad(id, "state", 0)
		end
	end
end

-- When any tsunami starts (including ours), immediately silence sirens if muted
function onTsunami(transform, magnitude)
	if sirens_muted then
		silenceSirens()
	end
end

function onWhirlpool(transform, magnitude)
	if sirens_muted then
		silenceSirens()
	end
end

function onTornado(transform)
	if sirens_muted then
		silenceSirens()
	end
end

function onMeteor(transform, magnitude)
	if sirens_muted then
		silenceSirens()
	end
end

function onVolcano(transform)
	if sirens_muted then
		silenceSirens()
	end
end

function httpReply(port, request, reply)
	if port == PORT and request == "/sw/poll" then
		runCommand(reply)
	end
end

function onCustomCommand(full_message, peer_id, is_admin, is_auth, command, ...)
	local args = { ... }
	command = string.lower(command or "")

	local function aNum(i, default)
		return num(args[i], default)
	end

	if command == "?sp" or command == "?stormpower" or command == "?sphelp" then
		help(peer_id)
		return
	end

	if command == "?dist" or command == "?distance" then
		session.dist = math.max(1, math.min(5000, math.floor(aNum(1, session.dist))))
		announce(peer_id, "Spawn distance = " .. session.dist .. "m")
		return
	end
	if command == "?count" then
		session.count = math.max(1, math.min(50, math.floor(aNum(1, session.count))))
		announce(peer_id, "Spawn count = " .. session.count)
		return
	end
	if command == "?size" then
		session.size = math.max(0.1, math.min(20, aNum(1, session.size)))
		announce(peer_id, "Spawn size = " .. session.size)
		return
	end

	if command == "?shark" then
		runCommand(string.format("spawn_animal|%d|0|%d|%s|%s", peer_id, math.floor(aNum(1, session.count)), aNum(2, session.size), aNum(3, session.dist)))
	elseif command == "?whale" then
		runCommand(string.format("spawn_animal|%d|1|%d|%s|%s", peer_id, math.floor(aNum(1, session.count)), aNum(2, session.size), aNum(3, session.dist)))
	elseif command == "?kraken" then
		runCommand(string.format("spawn_animal|%d|4|%d|%s|%s", peer_id, math.floor(aNum(1, session.count)), aNum(2, session.size), aNum(3, session.dist)))
	elseif command == "?give" then
		local name = string.lower(tostring(args[1] or ""))
		local g = GIVE[name]
		if not g then
			announce(peer_id, "Usage: ?give pistol|smg|rifle|grenade|c4|spear|aid|flashlight")
			return
		end
		runCommand(string.format("give|%d|%d|%d|%d|%s", peer_id, g[1], g[2], g[3], g[4]))
		if name == "c4" then runCommand("c4_kit|" .. peer_id) end
		if name == "spear" then runCommand("spear_kit|" .. peer_id) end
	elseif command == "?outfit" then
		local name = string.lower(tostring(args[1] or ""))
		local id = OUTFITS[name]
		if not id then
			announce(peer_id, "Usage: ?outfit scuba|diving|armor|arctic|hazmat")
			return
		end
		runCommand(string.format("outfit|%d|%d", peer_id, id))
	elseif command == "?loadout" then
		runCommand("loadout|" .. peer_id)
	elseif command == "?heal" then
		runCommand("heal|" .. peer_id)
	elseif command == "?money" then
		runCommand("money|" .. peer_id)
	elseif command == "?cleanup" then
		runCommand("cleanup|" .. peer_id)
	elseif command == "?wind" then
		local w = aNum(1, 0)
		if w <= 0 then
			runCommand("sea|" .. peer_id .. "|0|0")
		elseif w <= 1 then
			runCommand("sea|" .. peer_id .. "|1|" .. tostring(w))
		else
			runCommand("sea|" .. peer_id .. "|2|1")
		end
	elseif command == "?waves" then
		local mode = string.lower(tostring(args[1] or "max"))
		if mode == "off" or mode == "calm" then
			runCommand("sea|" .. peer_id .. "|0|0")
		elseif mode == "choppy" then
			runCommand("sea|" .. peer_id .. "|1|0.72")
		elseif mode == "mega" or mode == "massive" then
			runCommand("sea|" .. peer_id .. "|2|1")
		else
			runCommand("sea|" .. peer_id .. "|1|1")
		end
	elseif command == "?tsunami" or command == "?megawave" then
		runCommand("mega_wave|" .. peer_id)
	elseif command == "?sirens" then
		local mode = string.lower(tostring(args[1] or "off"))
		runCommand("sirens|" .. peer_id .. "|" .. mode)
	end
end
