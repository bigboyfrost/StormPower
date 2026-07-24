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
local ultra_wind = 0 -- visual/force push; waves still clamp to 0-1 internally for gerstner height
-- sea_mode: 0 off, 1 weather waves, 2 massive loop, 3 legacy ultra, 4 impossible stacked waves
local sea_mode = 0
local tsunami_timer = 0
local tsunami_phase = 0 -- 0 wait, 1 just cancelled (spawn next)
local wave_dist = 150
local wave_peer = 0
local wave_pulse = 0 -- rotates spawn distance / event type for bigger-than-stock feel
local TSUNAMI_INTERVAL_NORMAL = 90
local TSUNAMI_INTERVAL_ULTRA = 70
-- Tall gerstner waves need time to exist — do not strobe-cancel into chaos
local TSUNAMI_INTERVAL_IMPOSSIBLE = 80
local sirens_muted = true
local tracked_sirens = {}
local siren_refresh = 0
local siren_scan = 0
local siren_scan_id = 1

-- Chaos Mode: timed assault that tries to kill the player (rate-limited)
local chaos = {
	active = false,
	peer = 0,
	t = 0,
	step = 0,
}

-- Vehicle boost table
local boost = {
	active = false,
	peer = 0,
	knots = 40,
	accum = 0,
	-- Hard teleport pulses (setVehiclePos / setGroupPos). Soft moveVehicle is ignored by physics on ships.
	interval = 12, -- ~5 Hz warps
	sign = 1,
	seat_name = nil,
	vehicle = 0,
	meters_per_pulse = 18, -- ~35 kn average at 5 Hz
}

local session = {
	count = 5,
	size = 1,
	dist = 20,
}

-- Equipment that must use the large (1) slot
local LARGE_EQUIP = {
	[9] = true, [10] = true, [16] = true, [26] = true, [27] = true,
	[33] = true, [35] = true, [37] = true, [39] = true, [74] = true, [81] = true,
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

local function lookFlat(peer_id)
	local lx, ly, lz, lok = server.getPlayerLookDirection(peer_id)
	if not lok then
		return 0, 1
	end
	local len = math.sqrt(lx * lx + lz * lz)
	if len < 0.05 then
		-- Looking nearly straight up/down — use last non-vertical fallback (north)
		return 0, 1
	end
	return lx / len, lz / len
end

-- Spawns ahead of look direction. Never at the player's feet.
local function frontMatrix(peer_id, distance, y_offset, lateral)
	y_offset = y_offset or 0
	distance = math.max(1, distance or 20)
	lateral = lateral or 0
	local pos, ok = server.getPlayerPos(peer_id)
	if not ok then return nil end
	local lx, lz = lookFlat(peer_id)
	local rx, rz = -lz, lx -- right vector
	return matrix.translation(
		pos[13] + lx * distance + rx * lateral,
		pos[14] + y_offset,
		pos[15] + lz * distance + rz * lateral
	)
end

-- Wave events: always on sea surface (y=0), always ahead at a safe distance
local function waveMatrix(peer_id, distance, lateral)
	distance = math.max(80, distance or 150)
	lateral = lateral or 0
	local pos, ok = server.getPlayerPos(peer_id)
	if not ok then return nil end
	local lx, lz = lookFlat(peer_id)
	local rx, rz = -lz, lx
	return matrix.translation(
		pos[13] + lx * distance + rx * lateral,
		0,
		pos[15] + lz * distance + rz * lateral
	)
end

local function getCharacter(peer_id)
	local char_id, ok = server.getPlayerCharacterID(peer_id)
	if ok then return char_id end
	return nil
end

local function resolvePeer(peer_id)
	local players = server.getPlayers()
	for _, pl in pairs(players) do
		if pl.id == peer_id then return peer_id end
	end
	for _, pl in pairs(players) do
		return pl.id
	end
	return 0
end

local function slotEmpty(char_id, slot)
	local eq, ok = server.getCharacterItem(char_id, slot)
	if not ok then return true end
	return eq == nil or eq == 0
end

-- Place item into the first empty matching slot so gear spreads across inventory.
-- is_active MUST be false — true makes guns/tools auto-fire / auto-activate on spawn.
local function giveSpread(char_id, equip_id, preferred_slot, int_v, float_v)
	local large = LARGE_EQUIP[equip_id] == true
	if large then
		if slotEmpty(char_id, 1) or preferred_slot == 1 then
			return server.setCharacterItem(char_id, 1, equip_id, false, int_v, float_v)
		end
		return server.setCharacterItem(char_id, 1, equip_id, false, int_v, float_v)
	end
	local order = {}
	local start = preferred_slot or 2
	if start < 2 then start = 2 end
	for s = start, 9 do order[#order + 1] = s end
	for s = 2, start - 1 do order[#order + 1] = s end
	for i = 1, #order do
		local s = order[i]
		if slotEmpty(char_id, s) then
			return server.setCharacterItem(char_id, s, equip_id, false, int_v, float_v)
		end
	end
	return server.setCharacterItem(char_id, start, equip_id, false, int_v, float_v)
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

local function applyWeather()
	-- Keep stock wave height via clamp 0-1, but also re-apply ultra_wind each tick
	-- so force/fx get the higher value when the engine accepts it.
	local w = weather_wind
	if ultra_wind > w then w = ultra_wind end
	server.setWeather(weather_fog, weather_rain, w)
end

local function setWeatherState(fog, rain, wind, ultra)
	weather_fog = fog
	weather_rain = rain
	weather_wind = math.max(0, math.min(1, wind))
	ultra_wind = math.max(0, ultra or 0)
	applyWeather()
end

local function isSirenVehicle(vehicle_id)
	local btn, ok = server.getVehicleButton(vehicle_id, "siren_off")
	if ok and btn then return true end
	local trig, tok = server.getVehicleButton(vehicle_id, "trigger")
	local dial, dok = server.getVehicleDial(vehicle_id, "Warning System Enabled")
	return tok and trig and dok and dial
end

local function trackSiren(vehicle_id)
	if vehicle_id and vehicle_id > 0 then
		tracked_sirens[vehicle_id] = true
	end
end

local function silenceOne(id)
	local n = 0
	-- Official disasters mute path (keypad "state")
	if server.setVehicleKeypad(id, "state", 0) then n = n + 1 end
	-- Hard stop the siren microprocessor (vehicle has button custom_name="siren_off")
	server.pressVehicleButton(id, "siren_off")
	n = n + 1
	return n
end

local function discoverSirensScan()
	-- Probe vehicle IDs — there is no getAllVehicles API.
	-- Siren towers expose a button named "siren_off".
	local checked = 0
	while checked < 40 do
		local id = siren_scan_id
		siren_scan_id = siren_scan_id + 1
		if siren_scan_id > 4000 then siren_scan_id = 1 end
		checked = checked + 1
		if not tracked_sirens[id] then
			local btn, ok = server.getVehicleButton(id, "siren_off")
			if ok and btn then
				trackSiren(id)
				if sirens_muted then silenceOne(id) end
			end
		end
	end
end

local function silenceSirens()
	local n = 0
	for id, _ in pairs(tracked_sirens) do
		n = n + silenceOne(id)
	end
	server.setAudioMood(-1, 0)
	return n
end

local function enableSirens()
	local n = 0
	for id, _ in pairs(tracked_sirens) do
		if server.setVehicleKeypad(id, "state", 1) then n = n + 1 end
	end
	server.setAudioMood(-1, 2)
	return n
end

local function killSirenTowers(peer_id)
	local n = 0
	for id, _ in pairs(tracked_sirens) do
		silenceOne(id)
		if server.despawnVehicle(id, true) then n = n + 1 end
		tracked_sirens[id] = nil
	end
	notify(peer_id, "Despawned " .. n .. " siren towers")
	announce(peer_id, "Siren towers removed. Disable 'Enable Sirens' in Default Natural Disasters to stop them coming back on new worlds.")
	return n
end

local function spawnMegaWaveNear(peer_id, dist)
	-- Always spawn AHEAD of the player at spawn distance (never on top of them).
	dist = math.max(80, dist or wave_dist or 150)
	wave_dist = dist
	wave_peer = peer_id
	local mat = waveMatrix(peer_id, dist, 0)
	if not mat then
		return false
	end
	-- Magnitude >1 scales gerstner height in the ocean shader
	server.spawnTsunami(mat, 4.0)
	if sirens_muted then
		silenceSirens()
	end
	return true
end

-- Mode 4: tall tsunamis only. Height comes from Mega Wave Engine (ocean shader),
-- not from wind multipliers / whirlpools / meteors (those turn seas into chaos).
local function spawnImpossibleWave(peer_id, dist)
	dist = math.max(80, dist or wave_dist or 150)
	wave_dist = dist
	wave_peer = peer_id
	wave_pulse = (wave_pulse or 0) + 1
	local phase = wave_pulse % 3
	local d = dist
	if phase == 1 then d = dist * 0.92
	elseif phase == 2 then d = dist * 1.12
	end
	d = math.max(80, math.min(5000, d))
	local mat = waveMatrix(peer_id, d, 0)
	if not mat then return false end
	server.spawnTsunami(mat, 5.0)
	if sirens_muted then silenceSirens() end
	return true
end

local function pulseWaveCycle(peer_id)
	-- Despawn then respawn to simulate continuous wave crests (engine: 1 gerstner max)
	if tsunami_phase == 0 then
		server.cancelGerstner()
		tsunami_phase = 1
		return
	end
	tsunami_phase = 0
	if sea_mode >= 4 then
		spawnImpossibleWave(peer_id, wave_dist)
	else
		spawnMegaWaveNear(peer_id, wave_dist)
	end
end

local function getSeatedVehicle(peer_id)
	local char_id = getCharacter(peer_id)
	if not char_id then return nil end
	local vid, ok = server.getCharacterVehicle(char_id)
	if ok and vid and vid ~= 0 then return vid end
	return nil
end

local function getVehicleGroupId(vehicle_id)
	local data, ok = server.getVehicleData(vehicle_id)
	if ok and data and data.group_id and data.group_id ~= 0 then
		return data.group_id
	end
	return nil
end

local function findSeatName(peer_id, vehicle_id)
	if not server.getVehicleComponents then return nil end
	local comps, ok = server.getVehicleComponents(vehicle_id)
	if not ok or not comps or not comps.seats then return nil end
	local char_id = getCharacter(peer_id)
	for _, seat in pairs(comps.seats) do
		if seat and seat.name and seat.name ~= "" then
			if seat.seated_peer_id == peer_id then return seat.name end
			if char_id and seat.seated_id == char_id then return seat.name end
		end
	end
	for _, seat in pairs(comps.seats) do
		if seat and seat.name and seat.name ~= "" then return seat.name end
	end
	return nil
end

local function pickBoostSign(peer_id, mat)
	local ox, oy, oz = matrix.position(mat)
	local function worldFlat(local_z)
		local p = matrix.multiply(mat, matrix.translation(0, 0, local_z))
		local x, y, z = matrix.position(p)
		local dx, dz = x - ox, z - oz
		local len = math.sqrt(dx * dx + dz * dz)
		if len < 0.001 then return 0, 0 end
		return dx / len, dz / len
	end
	local fx, fz = worldFlat(1)
	local bx, bz = worldFlat(-1)
	local wx, wz = lookFlat(peer_id)
	local lx, ly, lz, lok = server.getPlayerLookDirection(peer_id)
	if lok and matrix.multiplyXYZW then
		local tx, ty, tz = matrix.multiplyXYZW(mat, lx, ly, lz, 0)
		local len = math.sqrt(tx * tx + tz * tz)
		if len > 0.05 then
			wx, wz = tx / len, tz / len
		end
	end
	if (bx * wx + bz * wz) > (fx * wx + fz * wz) then return -1 end
	return 1
end

--[[
  Soft moveVehicle is almost useless on large floating ships — buoyancy/physics
  snap them back. Hard setVehiclePos / setGroupPos actually relocates the craft.
  Tradeoff: brief unload/reload hitch each pulse.
]]
local function applyVehicleBoost(peer_id, game_ticks)
	local vid = getSeatedVehicle(peer_id)
	if not vid then
		if boost.active then
			boost.active = false
			boost.accum = 0
			boost.seat_name = nil
			boost.vehicle = 0
			notify(peer_id, "Boost OFF (left seat)")
		end
		return false
	end

	boost.vehicle = vid
	boost.accum = (boost.accum or 0) + math.max(1, game_ticks or 1)
	if boost.accum < (boost.interval or 12) then
		return true
	end
	boost.accum = 0

	local mat, ok = server.getVehiclePos(vid)
	if not ok or not mat then return false end

	local meters = boost.meters_per_pulse or 18
	local sign = boost.sign or 1
	local target = matrix.multiply(mat, matrix.translation(0, 0, sign * meters))

	local group_id = getVehicleGroupId(vid)
	if group_id and server.setGroupPos then
		server.setGroupPos(group_id, target)
	elseif server.setVehiclePosSafe then
		server.setVehiclePosSafe(vid, target)
	elseif server.setVehiclePos then
		server.setVehiclePos(vid, target)
	else
		server.moveVehicle(vid, target)
	end

	if boost.seat_name and server.setSeated then
		local char_id = getCharacter(peer_id)
		if char_id then
			server.setSeated(char_id, vid, boost.seat_name)
		end
	end
	return true
end

local function stopChaos()
	chaos.active = false
	chaos.t = 0
	chaos.step = 0
end

local function endChaosCleanup(peer_id, reason)
	stopChaos()
	sea_mode = 0
	server.cancelGerstner()
	setWeatherState(0, 0, 0, 0)
	server.setAudioMood(-1, 0)
	cleanup(peer_id)
	notify(peer_id, reason or "Chaos ended — cleaned up")
	announce(peer_id, reason or "Chaos Mode stopped. Spawns cleared.")
end

local function startChaos(peer_id)
	chaos.active = true
	chaos.peer = peer_id
	chaos.t = 0
	chaos.step = 0
	server.setGameSetting("player_damage", true)
	server.setGameSetting("vehicle_damage", true)
	server.setGameSetting("npc_damage", true)
	server.setGameSetting("no_clip", false)
	sea_mode = 4
	wave_peer = peer_id
	wave_dist = math.max(80, session.dist or 120)
	tsunami_timer = 0
	tsunami_phase = 1
	setWeatherState(0.4, 1, 1, 50)
	server.setAudioMood(-1, 3)
	sirens_muted = false
	announce(peer_id, "CHAOS MODE — 20 seconds. Then auto-stops and cleans up.")
	notify(peer_id, "CHAOS MODE ON (20s)")
end

local function chaosTick(gt)
	if not chaos.active then return end
	local peer = resolvePeer(chaos.peer)
	chaos.t = chaos.t + gt
	local char_id = getCharacter(peer)
	local pos, pok = server.getPlayerPos(peer)

	-- Hard stop at 20 seconds — always clean up
	if chaos.t >= 60 * 20 then
		endChaosCleanup(peer, "Chaos ended (20s) — cleaned up")
		return
	end

	if chaos.t % 45 < gt then
		chaos.step = chaos.step + 1
		local s = chaos.step

		if pok then
			for i = 1, 3 do
				local a = (i / 3) * math.pi * 2 + chaos.t * 0.01
				local mat = matrix.translation(pos[13] + math.cos(a) * 18, pos[14] - 2, pos[15] + math.sin(a) * 18)
				local oid, ok = server.spawnAnimal(mat, (s % 2 == 0) and 0 or 4, 1.4)
				if ok then track("object", oid) end
			end
			if s % 2 == 0 then
				local mat = matrix.translation(pos[13] + 12, pos[14], pos[15] + 8)
				local oid, ok = server.spawnCreature(mat, 1, 1.5)
				if ok then track("object", oid) end
			end
		end

		if pok then
			for i = 0, 3 do
				local a = (i / 4) * math.pi * 2 + s
				local mat = matrix.translation(pos[13] + math.cos(a) * 10, pos[14], pos[15] + math.sin(a) * 10)
				server.spawnExplosion(mat, 0.75)
			end
			local fmat = matrix.translation(pos[13] + 6, pos[14], pos[15] - 4)
			local oid, ok = server.spawnFire(fmat, 6, -1, true, true, 0, 4)
			if ok then track("object", oid) end
		end

		if pok then
			local dmat = matrix.translation(pos[13] + 90, 0, pos[15] + 40)
			if s % 3 == 1 then server.spawnTornado(dmat)
			elseif s % 3 == 2 then server.spawnMeteorShower(dmat, 1, true)
			else server.spawnWhirlpool(dmat, 1) end
			pulseWaveCycle(peer)
		end

		if char_id then
			local hp = math.max(0, 100 - s * 12)
			server.setCharacterData(char_id, hp, false, false)
			if hp <= 5 or s >= 10 then
				server.killCharacter(char_id)
				announce(peer, "CHAOS MODE got you.")
				endChaosCleanup(peer, "Chaos finished — cleaned up")
				return
			end
		end
	end

	if pok and chaos.t % 20 < gt then
		local mat = matrix.translation(pos[13] + (math.random() - 0.5) * 14, pos[14], pos[15] + (math.random() - 0.5) * 14)
		server.spawnExplosion(mat, 0.35)
	end
end

local function runCommand(line)
	if not line or line == "" or line == "NONE" then return end
	if string.find(line, "connect()", 1, true) or string.find(line, "Connection refused", 1, true) then
		return
	end
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
			local mat = frontMatrix(peer_id, dist + (i - 1) * 4, -2, (i % 3 - 1) * 3)
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
			local mat = frontMatrix(peer_id, dist + (i - 1) * 3, 0, (i % 3 - 1) * 2)
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
			local mat = frontMatrix(peer_id, dist + (i - 1) * 2, 1, (i % 3 - 1) * 1.5)
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
		local count = math.max(1, math.min(9, math.floor(num(p[7], 1))))
		local char_id = getCharacter(peer_id)
		local n = 0
		if char_id then
			for i = 1, count do
				if giveSpread(char_id, equip, slot, int_v, float_v) then n = n + 1 end
			end
		end
		if n > 0 then
			notify(peer_id, "Added " .. n .. " item(s) (spread in inventory)")
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
			giveSpread(char_id, 31, 2, 4, 0)
			giveSpread(char_id, 32, 3, 0, 0)
			notify(peer_id, "C4 kit given")
		end

	elseif cmd == "spear_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			giveSpread(char_id, 33, 1, 5, 0)
			giveSpread(char_id, 34, 2, 10, 0)
			notify(peer_id, "Speargun kit given")
		end

	elseif cmd == "flare_kit" then
		local char_id = getCharacter(peer_id)
		if char_id then
			giveSpread(char_id, 13, 1, 4, 0)
			giveSpread(char_id, 14, 2, 12, 0)
			notify(peer_id, "Flare kit given")
		end

	elseif cmd == "disaster" then
		local kind = p[3] or "tsunami"
		local dist = math.max(80, math.min(5000, num(p[4], session.dist)))
		local mat
		if kind == "tsunami" or kind == "whirlpool" then
			mat = waveMatrix(peer_id, dist, 0)
		else
			mat = frontMatrix(peer_id, dist, 0)
		end
		if mat then
			if kind == "tsunami" then server.spawnTsunami(mat, 4.0)
			elseif kind == "whirlpool" then server.spawnWhirlpool(mat, 3.0)
			elseif kind == "tornado" then server.spawnTornado(mat)
			elseif kind == "meteor" then server.spawnMeteor(mat, 0.6, false)
			elseif kind == "shower" then server.spawnMeteorShower(mat, 0.6, false)
			elseif kind == "volcano" then server.spawnVolcano(mat)
			end
			if sirens_muted then silenceSirens() end
			notify(peer_id, "Disaster @ " .. math.floor(dist) .. "m ahead")
		end

	elseif cmd == "weather" then
		local fog = num(p[3], 0)
		local rain = num(p[4], 0)
		local wind = num(p[5], 0)
		sea_mode = 0
		tsunami_phase = 0
		server.cancelGerstner()
		setWeatherState(fog, rain, wind, 0)
		notify(peer_id, string.format("Weather set (wind %.2f)", wind))

	elseif cmd == "ultra_wind" then
		local wind = num(p[3], 5)
		ultra_wind = math.max(0, wind)
		weather_wind = 1
		if sea_mode < 1 then sea_mode = 1 end
		applyWeather()
		notify(peer_id, "Wind x" .. tostring(wind))
		announce(peer_id, "Wind force x" .. tostring(wind) .. " (vehicle shove). Wave height is separate — use Ultra Waves + Mega Wave Engine.")

	elseif cmd == "sea" then
		local mode = math.floor(num(p[3], 0))
		local wind = num(p[4], 1)
		local dist = math.max(80, math.min(5000, num(p[5], session.dist)))
		sea_mode = mode
		tsunami_timer = 0
		tsunami_phase = 0
		wave_dist = dist
		wave_peer = peer_id
		wave_pulse = 0
		session.dist = dist
		if mode <= 0 then
			server.cancelGerstner()
			setWeatherState(weather_fog, weather_rain, 0, 0)
			notify(peer_id, "Seas calmed")
			announce(peer_id, "Wave mode OFF")
		else
			-- Wave modes never use ultra wind — that yanks vehicles around.
			-- Tall water comes from spawnTsunami magnitude + Mega Wave Engine shader.
			local w = math.max(0, math.min(1, wind))
			if wind > 1 then w = 1 end
			if mode >= 2 then w = math.min(w, 1) end
			setWeatherState(weather_fog, weather_rain, w, 0)
			if mode >= 2 then
				sirens_muted = true
				silenceSirens()
				server.cancelGerstner()
				tsunami_phase = 1
				pulseWaveCycle(peer_id)
				if mode >= 4 then
					notify(peer_id, "ULTRA WAVES @ " .. math.floor(dist) .. "m")
					announce(peer_id, "Tall tsunami pulses ahead (no x50 wind). Enable Mega Wave Engine in the menu for real height.")
				else
					notify(peer_id, (mode >= 3 and "ULTRA " or "") .. "MASSIVE WAVES @ " .. math.floor(dist) .. "m")
					announce(peer_id, "Tsunami loop ahead of you at " .. math.floor(dist) .. "m. Sirens muted.")
				end
			else
				server.cancelGerstner()
				notify(peer_id, string.format("Sea state ON (wind %.2f)", weather_wind))
			end
		end

	elseif cmd == "mega_wave" then
		local dist = math.max(80, math.min(5000, num(p[3], session.dist)))
		wave_dist = dist
		if spawnMegaWaveNear(peer_id, dist) then
			setWeatherState(weather_fog, weather_rain, math.min(1, weather_wind > 0 and weather_wind or 1), 0)
			if sirens_muted then silenceSirens() end
			notify(peer_id, "Mega wave @ " .. math.floor(dist) .. "m ahead")
		else
			announce(peer_id, "Could not spawn mega wave")
		end

	elseif cmd == "chaos" then
		local mode = tostring(p[3] or "on")
		if mode == "off" or mode == "0" or mode == "stop" then
			endChaosCleanup(peer_id, "Chaos stopped — cleaned up")
		else
			startChaos(peer_id)
		end

	elseif cmd == "boost" then
		local mode = tostring(p[3] or "on")
		if mode == "off" or mode == "0" or mode == "stop" then
			boost.active = false
			boost.accum = 0
			boost.seat_name = nil
			boost.vehicle = 0
			notify(peer_id, "Vehicle boost OFF")
		elseif mode == "flip" or mode == "rev" or mode == "reverse" then
			boost.sign = -((boost.sign or 1))
			notify(peer_id, "Boost direction flipped")
			announce(peer_id, "Boost axis sign = " .. tostring(boost.sign) .. " (use if it goes backward)")
		else
			local vid = getSeatedVehicle(peer_id)
			if not vid then
				announce(peer_id, "Sit in a vehicle seat first, then enable boost.")
				notify(peer_id, "Not in a vehicle")
			else
				local mat, mok = server.getVehiclePos(vid)
				boost.active = true
				boost.peer = peer_id
				boost.accum = 0
				boost.vehicle = vid
				boost.seat_name = findSeatName(peer_id, vid)
				if mok and mat then
					boost.sign = pickBoostSign(peer_id, mat)
				else
					boost.sign = 1
				end
				notify(peer_id, "Boost WARP ON")
				announce(peer_id, "Vehicle boost uses hard teleports (~18m pulses). Expect a brief hitch. Wrong way: ?boost flip")
			end
		end

	elseif cmd == "notify_update" then
		local ver = tostring(p[3] or "?")
		local msg = "Update available: StormPower v" .. ver
		announce(-1, msg .. " — open overlay → Other → Check for Updates")
		local players = server.getPlayers()
		if players then
			for _, pl in pairs(players) do
				if pl.id then notify(pl.id, msg) end
			end
		else
			notify(peer_id, msg)
		end

	elseif cmd == "sirens" then
		local mode = tostring(p[3] or "off")
		if mode == "on" or mode == "1" then
			sirens_muted = false
			local n = enableSirens()
			notify(peer_id, "Sirens enabled (" .. n .. ")")
		elseif mode == "kill" or mode == "despawn" then
			sirens_muted = true
			killSirenTowers(peer_id)
		else
			sirens_muted = true
			local n = silenceSirens()
			notify(peer_id, "Sirens muted (actions=" .. n .. ")")
			announce(peer_id, "Pressing siren_off + keypad state=0 every tick. Use Despawn Siren Towers if sound continues.")
		end

	elseif cmd == "explode" then
		local mag = math.max(0.05, math.min(1, num(p[3], 0.5)))
		local dist = math.max(5, math.min(5000, num(p[4], 15)))
		local mat = frontMatrix(peer_id, dist, 0)
		if mat then
			server.spawnExplosion(mat, mag)
			notify(peer_id, string.format("Boom %.2f @ %dm", mag, math.floor(dist)))
		end

	elseif cmd == "explode_ring" then
		local mag = math.max(0.05, math.min(1, num(p[3], 0.5)))
		local dist = math.max(8, math.min(5000, num(p[4], 20)))
		local pos, ok = server.getPlayerPos(peer_id)
		if ok then
			for i = 0, 5 do
				local a = (i / 6) * math.pi * 2
				local mat = matrix.translation(pos[13] + math.cos(a) * dist, pos[14], pos[15] + math.sin(a) * dist)
				server.spawnExplosion(mat, mag)
			end
			notify(peer_id, "Ring of blasts")
		end

	elseif cmd == "firebomb" then
		local size = math.max(1, math.min(10, num(p[3], 4)))
		local emag = math.max(0, math.min(5, num(p[4], 3)))
		local dist = math.max(5, math.min(5000, num(p[5], 15)))
		local mat = frontMatrix(peer_id, dist, 0)
		if mat then
			local oid, ok = server.spawnFire(mat, size, -1, true, true, 0, emag)
			if ok then track("object", oid) end
			notify(peer_id, "Fire bomb planted")
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
			for slot = 1, 9 do server.setCharacterItem(char_id, slot, 0, false, 0, 0) end
			-- false = don't auto-activate / auto-fire weapons
			server.setCharacterItem(char_id, 1, 39, false, 30, 0)
			server.setCharacterItem(char_id, 2, 40, false, 60, 0)
			server.setCharacterItem(char_id, 3, 41, false, 5, 0)
			server.setCharacterItem(char_id, 4, 11, false, 4, 0)
			server.setCharacterItem(char_id, 5, 31, false, 4, 0)
			server.setCharacterItem(char_id, 6, 32, false, 0, 0)
			server.setCharacterItem(char_id, 7, 15, false, 0, 100)
			server.setCharacterItem(char_id, 8, 6, false, 0, 100)
			server.setCharacterItem(char_id, 9, 12, false, 4, 0)
			server.setCharacterItem(char_id, 10, 78, false, 0, 0)
			notify(peer_id, "Loadout ready (spread)")
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
	announce(peer_id, "?sp  ?dist ?count ?size")
	announce(peer_id, "?shark / ?whale / ?kraken")
	announce(peer_id, "?give pistol|smg|rifle|grenade|c4|spear|aid")
	announce(peer_id, "?waves calm|choppy|max|mega|ultra|off")
	announce(peer_id, "?tsunami [dist]   Wave ahead of you")
	announce(peer_id, "?sirens off|on|kill")
	announce(peer_id, "?boom [0-1] [dist]   Explosion")
	announce(peer_id, "?wind <0-50>   Wind force only (not wave height)")
	announce(peer_id, "?chaos / ?chaos off")
	announce(peer_id, "?boost / ?boost off / ?boost flip   Seat vehicle speed boost")
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

function onPlayerSit(peer_id, vehicle_id, seat_name)
	if boost.active and peer_id == boost.peer then
		boost.vehicle = vehicle_id
		if seat_name and seat_name ~= "" then
			boost.seat_name = seat_name
		end
	end
end

function onCreate(is_world_create)
	spawned = {}
	sea_mode = 0
	weather_wind = 0
	ultra_wind = 0
	tsunami_timer = 0
	tsunami_phase = 0
	wave_pulse = 0
	tick_counter = 0
	sirens_muted = true
	tracked_sirens = {}
	stopChaos()
	boost.active = false
	boost.accum = 0
	boost.seat_name = nil
	boost.vehicle = 0
	silenceSirens()
	announce(-1, "StormPower ready. Sirens muted. Type ?sp for commands.")
end

function onTick(game_ticks)
	local gt = game_ticks or 1
	tick_counter = tick_counter + gt
	if tick_counter >= POLL_EVERY then
		tick_counter = 0
		server.httpGet(PORT, "/sw/poll")
	end

	if sea_mode >= 1 or ultra_wind > 0 then
		applyWeather()
	end

	-- Aggressive mute: disasters addon re-triggers via pressVehicleButton("trigger")
	if sirens_muted then
		siren_refresh = siren_refresh + gt
		if siren_refresh >= 15 then
			siren_refresh = 0
			silenceSirens()
		end
		siren_scan = siren_scan + gt
		if siren_scan >= 30 then
			siren_scan = 0
			discoverSirensScan()
		end
	end

	if sea_mode >= 2 then
		local interval = TSUNAMI_INTERVAL_NORMAL
		if sea_mode >= 4 then
			interval = TSUNAMI_INTERVAL_IMPOSSIBLE
		elseif sea_mode >= 3 then
			interval = TSUNAMI_INTERVAL_ULTRA
		end
		local step = math.floor(interval / 2)
		if step < 8 then step = 8 end
		tsunami_timer = tsunami_timer + gt
		if tsunami_timer >= step then
			tsunami_timer = 0
			local peer = wave_peer
			local players = server.getPlayers()
			local found = false
			for _, pl in pairs(players) do
				if pl.id == peer then found = true break end
			end
			if not found then
				for _, pl in pairs(players) do
					peer = pl.id
					break
				end
			end
			pulseWaveCycle(peer)
		end
	end

	-- Vehicle boost: +40 knots while seated
	if boost.active then
		local peer = resolvePeer(boost.peer)
		applyVehicleBoost(peer, gt)
	end

	chaosTick(gt)
end

function onVehicleLoad(vehicle_id)
	local btn, ok = server.getVehicleButton(vehicle_id, "siren_off")
	if ok and btn then
		trackSiren(vehicle_id)
		if sirens_muted then silenceOne(vehicle_id) end
		return
	end
	-- Fallback: trigger + state keypad pattern from default_siren
	local trig, tok = server.getVehicleButton(vehicle_id, "trigger")
	if tok and trig then
		local dial, dok = server.getVehicleDial(vehicle_id, "Warning System Enabled")
		if dok and dial then
			trackSiren(vehicle_id)
			if sirens_muted then silenceOne(vehicle_id) end
		end
	end
end

function onSpawnAddonComponent(id, name, type_string, addon_index)
	if type_string == "vehicle" and (name == "default_siren" or name == "siren") then
		trackSiren(id)
		if sirens_muted then silenceOne(id) end
	end
end

function onTsunami(transform, magnitude)
	if sirens_muted then silenceSirens() end
end

function onWhirlpool(transform, magnitude)
	if sirens_muted then silenceSirens() end
end

function onTornado(transform)
	if sirens_muted then silenceSirens() end
end

function onMeteor(transform, magnitude)
	if sirens_muted then silenceSirens() end
end

function onVolcano(transform)
	if sirens_muted then silenceSirens() end
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
		runCommand(string.format("give|%d|%d|%d|%d|%s|1", peer_id, g[1], g[2], g[3], g[4]))
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
			runCommand("sea|" .. peer_id .. "|0|0|" .. session.dist)
		elseif w <= 1 then
			runCommand("sea|" .. peer_id .. "|1|" .. tostring(w) .. "|" .. session.dist)
		elseif w < 5 then
			runCommand("sea|" .. peer_id .. "|2|1|" .. session.dist)
		elseif w < 40 then
			runCommand("sea|" .. peer_id .. "|3|" .. tostring(w) .. "|" .. session.dist)
		else
			runCommand("ultra_wind|" .. peer_id .. "|" .. tostring(w))
			runCommand("sea|" .. peer_id .. "|4|" .. tostring(w) .. "|" .. session.dist)
		end
	elseif command == "?waves" then
		local mode = string.lower(tostring(args[1] or "max"))
		if mode == "off" or mode == "calm" then
			runCommand("sea|" .. peer_id .. "|0|0|" .. session.dist)
		elseif mode == "choppy" then
			runCommand("sea|" .. peer_id .. "|1|0.72|" .. session.dist)
		elseif mode == "ultra" then
			runCommand("sea|" .. peer_id .. "|4|1|" .. session.dist)
		elseif mode == "mega" or mode == "massive" then
			runCommand("sea|" .. peer_id .. "|2|1|" .. session.dist)
		else
			runCommand("sea|" .. peer_id .. "|1|1|" .. session.dist)
		end
	elseif command == "?tsunami" or command == "?megawave" then
		local d = aNum(1, session.dist)
		runCommand("mega_wave|" .. peer_id .. "|" .. d)
	elseif command == "?sirens" then
		local mode = string.lower(tostring(args[1] or "off"))
		runCommand("sirens|" .. peer_id .. "|" .. mode)
	elseif command == "?boom" or command == "?explode" then
		local mag = aNum(1, 0.5)
		local d = aNum(2, 15)
		runCommand(string.format("explode|%d|%s|%s", peer_id, mag, d))
	elseif command == "?chaos" then
		local mode = string.lower(tostring(args[1] or "on"))
		if mode == "off" or mode == "stop" then
			runCommand("chaos|" .. peer_id .. "|off")
		else
			runCommand("chaos|" .. peer_id .. "|on")
		end
	elseif command == "?boost" then
		local mode = string.lower(tostring(args[1] or "on"))
		if mode == "off" or mode == "stop" then
			runCommand("boost|" .. peer_id .. "|off")
		elseif mode == "flip" or mode == "rev" or mode == "reverse" then
			runCommand("boost|" .. peer_id .. "|flip")
		else
			runCommand("boost|" .. peer_id .. "|on")
		end
	end
end
