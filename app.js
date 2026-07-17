/*
 * i-Water static installation console
 * Production installation hierarchy:
 * Customer -> Location -> Project -> Unit -> Water Project.
 *
 * Hardware, modules and physical ports belong to a Unit. Explicit allocation
 * records connect that hardware to Water Projects. Telemetry is immutable and
 * is the only source for live values; thresholds live in MeasurementControls.
 */
(function () {
  "use strict";

  var SCHEMA_VERSION = "iw-installation-2.5";
  var STORAGE_KEY = "iw-installer-console-v9";
  var view = document.getElementById("view");
  var searchInput = document.getElementById("globalSearch");
  var searchQuery = "";
  var db;
  var integrityErrors = [];
  var DASHBOARD_WATER_PROJECT_LIMIT = 3;
  var CONFIGURATION_SCHEMA = window.IWATER_CONFIGURATION_SCHEMA || { records: [] };

  var PARAMS = {
    ph: { label: "pH", unit: "pH", decimals: 2 },
    alkalinity: { label: "ALKA", unit: "ppm", decimals: 0 },
    freeChlorine: { label: "FC", unit: "ppm", decimals: 2 },
    orp: { label: "ORP", unit: "mV", decimals: 0 },
    temperature: { label: "Temp", unit: "°C", decimals: 1 },
    pressure: { label: "Pressure", unit: "bar", decimals: 2 },
    flow: { label: "Flow", unit: "m³/h", decimals: 1 },
    level: { label: "Level", unit: "%", decimals: 0 }
  };

  var COMPONENT_META = {
    filtration_pump: { label: "Filtration pump", category: "Filtration", direction: "output" },
    pressure_sensor: { label: "Pressure sensor", category: "Filtration", direction: "input" },
    flow_sensor: { label: "Flow sensor", category: "Filtration", direction: "input" },
    ph_sensor: { label: "pH sensor", category: "Water stability", direction: "input" },
    ph_dosing_pump: { label: "pH dosing pump", category: "Water stability", direction: "output" },
    alkalinity_sensor: { label: "ALKA sensor", category: "Water stability", direction: "input" },
    alkalinity_dosing_pump: { label: "ALKA dosing pump", category: "Water stability", direction: "output" },
    free_chlorine_sensor: { label: "Free chlorine sensor", category: "Disinfection", direction: "input" },
    orp_sensor: { label: "ORP sensor", category: "Disinfection", direction: "input" },
    chlorine_dosing_pump: { label: "Chlorine dosing pump", category: "Disinfection", direction: "output" },
    electrolysis: { label: "Electrolysis", category: "Disinfection", direction: "output" },
    temperature_sensor: { label: "Temperature sensor", category: "Temperature", direction: "input" },
    level_sensor: { label: "Level sensor", category: "Level control", direction: "input" },
    fill_valve: { label: "Fill valve", category: "Level control", direction: "output" }
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function ago(hours) {
    return new Date(Date.now() - hours * 3600000).toISOString();
  }

  function createInstallationState() {
    var data = {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: nowIso(),
      customers: [
        { id: "CUS-001", name: "Aqua Estates", customerNumber: "C-1001", email: "facilities@aqua-estates.example" },
        { id: "CUS-002", name: "City Waterworks", customerNumber: "C-1002", email: "operations@city-waterworks.example" }
      ],
      users: [
        {
          id: "USR-INSTALLER",
          companyName: "i-Water",
          name: "Service Operator",
          address: { street: "Wetstraat", houseNumber: "16", postalCode: "1000", city: "Brussels", country: "Belgium", countryCode: "BE" },
          telephone: "+32 2 555 01 01",
          email: "service@i-water.example",
          notificationChannel: "Mail"
        }
      ],
      locations: [
        { id: "LOC-001", customerId: "CUS-001", name: "Brussels Wellness Campus", address: { street: "Wetstraat", houseNumber: "16", postalCode: "1000", city: "Brussels", countryCode: "BE" } },
        { id: "LOC-002", customerId: "CUS-001", name: "Ghent Garden Residence", address: { street: "Korenmarkt", houseNumber: "8", postalCode: "9000", city: "Ghent", countryCode: "BE" } },
        { id: "LOC-003", customerId: "CUS-002", name: "Antwerp Recreation Park", address: { street: "Parklaan", houseNumber: "42", postalCode: "2000", city: "Antwerp", countryCode: "BE" } }
      ],
      projects: [
        { id: "PRJ-001", locationId: "LOC-001", name: "Central Lagoon", code: "LAG-BRU", description: "Lagoon with main basin and spa." },
        { id: "PRJ-002", locationId: "LOC-001", name: "Thermal Suite", code: "THM-BRU", description: "Indoor wellness water circuit." },
        { id: "PRJ-003", locationId: "LOC-002", name: "Garden Pools", code: "GRD-GNT", description: "Outdoor swimming and reflection pools." },
        { id: "PRJ-004", locationId: "LOC-003", name: "Municipal Lagoons", code: "MUN-ANT", description: "Public recreational lagoon installation." }
      ],
      units: [
        { id: "UNT-001", projectId: "PRJ-001", name: "Lagoon Controller A", code: "UNIT-A01", macAddress: "5C:3A:45:10:20:01", firmwareVersion: "4.8.2", installedAt: "2025-03-14", workingHours: 11542, language: "en", timeZone: "Europe/Brussels", display: { autoLockEnabled: true, lockAfterMinutes: 5, screenCodeConfigured: true, dimPercent: 35 }, communication: { channel: "ethernet", connected: true, lastSeenAt: ago(0.15) } },
        { id: "UNT-002", projectId: "PRJ-002", name: "Thermal Controller", code: "UNIT-T01", macAddress: "5C:3A:45:10:20:02", firmwareVersion: "4.8.2", installedAt: "2025-07-02", workingHours: 8920, language: "nl", timeZone: "Europe/Brussels", display: { autoLockEnabled: true, lockAfterMinutes: 10, screenCodeConfigured: true, dimPercent: 25 }, communication: { channel: "wifi", connected: true, lastSeenAt: ago(1.2) } },
        { id: "UNT-003", projectId: "PRJ-003", name: "Garden Controller", code: "UNIT-G01", macAddress: "5C:3A:45:10:20:03", firmwareVersion: "4.7.9", installedAt: "2024-05-22", workingHours: 18344, language: "en", timeZone: "Europe/Brussels", display: { autoLockEnabled: true, lockAfterMinutes: 5, screenCodeConfigured: true, dimPercent: 40 }, communication: { channel: "wifi", connected: false, lastSeenAt: ago(31) } },
        { id: "UNT-004", projectId: "PRJ-004", name: "Public Lagoon Controller A", code: "UNIT-P01", macAddress: "5C:3A:45:10:20:04", firmwareVersion: "4.8.2", installedAt: "2026-01-11", workingHours: 4110, language: "nl", timeZone: "Europe/Brussels", display: { autoLockEnabled: true, lockAfterMinutes: 3, screenCodeConfigured: true, dimPercent: 30 }, communication: { channel: "ethernet", connected: true, lastSeenAt: ago(0.4) } },
        { id: "UNT-005", projectId: "PRJ-004", name: "Public Lagoon Controller B", code: "UNIT-P02", macAddress: "5C:3A:45:10:20:05", firmwareVersion: "4.8.1", installedAt: "2026-01-11", workingHours: 4092, language: "nl", timeZone: "Europe/Brussels", display: { autoLockEnabled: true, lockAfterMinutes: 3, screenCodeConfigured: true, dimPercent: 30 }, communication: { channel: "ethernet", connected: true, lastSeenAt: ago(0.6) } }
      ],
      waterProjects: [
        { id: "WPR-001", unitId: "UNT-001", name: "Main Lagoon", code: "WP-LAG-01", structure: "Lagoon", usage: "Public", conditions: "Outdoor", lengthM: 42, widthM: 18, averageDepthM: 1.25, volumeM3: 810 },
        { id: "WPR-002", unitId: "UNT-001", name: "Lagoon Spa", code: "WP-SPA-01", structure: "Spa", usage: "Private", conditions: "Outdoor", lengthM: 8, widthM: 5, averageDepthM: 1.1, volumeM3: 44 },
        { id: "WPR-003", unitId: "UNT-002", name: "Thermal Pool", code: "WP-THM-01", structure: "Pool", usage: "Private", conditions: "Indoor", lengthM: 15, widthM: 7, averageDepthM: 1.35, volumeM3: 142 },
        { id: "WPR-004", unitId: "UNT-003", name: "Garden Pool", code: "WP-GRD-01", structure: "Pool", usage: "Private", conditions: "Outdoor", lengthM: 12, widthM: 5, averageDepthM: 1.45, volumeM3: 87 },
        { id: "WPR-005", unitId: "UNT-003", name: "Reflection Pond", code: "WP-PND-01", structure: "Pond", usage: "Private", conditions: "Outdoor", lengthM: 18, widthM: 4, averageDepthM: 0.55, volumeM3: 40 },
        { id: "WPR-006", unitId: "UNT-004", name: "Family Lagoon", code: "WP-FAM-01", structure: "Lagoon", usage: "Public", conditions: "Outdoor", lengthM: 55, widthM: 24, averageDepthM: 1.2, volumeM3: 1320 },
        { id: "WPR-007", unitId: "UNT-005", name: "Sports Lagoon", code: "WP-SPT-01", structure: "Lagoon", usage: "Public", conditions: "Outdoor", lengthM: 50, widthM: 22, averageDepthM: 1.6, volumeM3: 1760 }
      ],
      unitModules: [],
      physicalPorts: [],
      unitComponents: [],
      unitModuleAllocations: [],
      componentPortAssignments: [],
      componentAllocations: [],
      telemetrySnapshots: [],
      filtrationProtocols: [],
      measurementControls: [],
      dosingProtocols: [],
      levelControlProtocols: [],
      notifications: [],
      notificationAcknowledgements: [],
      firmwareUpdates: [],
      commands: [],
      configurationValues: {}
    };

    data.units.forEach(function (unit) {
      data.unitModules.push(
        { id: unit.id + "-MOD-01", unitId: unit.id, slot: 1, name: "Universal I/O", model: "IWM-12", firmwareVersion: "2.4.0", active: true },
        { id: unit.id + "-MOD-02", unitId: unit.id, slot: 2, name: "Sensor module", model: "IWS-12", firmwareVersion: "2.2.1", active: true }
      );
      ["input", "output"].forEach(function (direction) {
        for (var p = 1; p <= 16; p += 1) {
          data.physicalPorts.push({
            id: unit.id + "-" + (direction === "input" ? "IN" : "OUT") + "-" + String(p).padStart(2, "0"),
            unitId: unit.id,
            direction: direction,
            label: (direction === "input" ? "IN-" : "OUT-") + String(p).padStart(2, "0"),
            signalType: direction === "input" ? "universal input" : "relay output"
          });
        }
      });
    });

    var unitPortCursor = {};
    data.units.forEach(function (unit) {
      unitPortCursor[unit.id] = { input: 1, output: 1, module: 0 };
    });

    function addComponent(wp, type, suffix, configuration) {
      var unit = findById(data.units, wp.unitId);
      var meta = COMPONENT_META[type];
      var cursor = unitPortCursor[unit.id];
      var number = String(cursor[meta.direction]).padStart(2, "0");
      var componentId = wp.id + "-CMP-" + suffix;
      var portId = unit.id + "-" + (meta.direction === "input" ? "IN" : "OUT") + "-" + number;
      var moduleId = unit.id + (cursor.module % 2 === 0 ? "-MOD-01" : "-MOD-02");
      cursor[meta.direction] += 1;
      cursor.module += 1;
      data.unitComponents.push({
        id: componentId,
        unitId: unit.id,
        type: type,
        category: meta.category,
        name: meta.label + " · " + wp.name,
        code: type.toUpperCase().replace(/_/g, "-").slice(0, 12) + "-" + wp.code.slice(-2),
        enabled: true,
        configuration: configuration || {}
      });
      data.componentPortAssignments.push({ id: "CPA-" + componentId, componentId: componentId, portId: portId, role: "primary" });
      data.componentAllocations.push({ id: "CAL-" + componentId, componentId: componentId, waterProjectId: wp.id, role: "primary" });
      data.unitModuleAllocations.push({ id: "UMA-" + componentId, moduleId: moduleId, componentId: componentId, channel: number });
      return componentId;
    }

    data.waterProjects.forEach(function (wp, index) {
      var ids = {};
      ids.filterPump = addComponent(wp, "filtration_pump", "FP", { variableSpeed: true, maxFlowM3h: 35 + index * 2 });
      ids.pressure = addComponent(wp, "pressure_sensor", "PS", { rangeBar: 6 });
      ids.flow = addComponent(wp, "flow_sensor", "FS", { pulsesPerLiter: 2 });
      ids.ph = addComponent(wp, "ph_sensor", "PH", { calibrationPoints: 2 });
      ids.phPump = addComponent(wp, "ph_dosing_pump", "PHP", { solution: index % 2 ? "pH+" : "pH-" });
      if (index % 2 === 0) {
        ids.alka = addComponent(wp, "alkalinity_sensor", "AL", { method: "titration" });
        ids.alkaPump = addComponent(wp, "alkalinity_dosing_pump", "ALP", { intervalMinutes: 8 });
      }
      ids.fc = addComponent(wp, "free_chlorine_sensor", "FC", { membraneSensor: true });
      if (index !== 4) {
        ids.orp = addComponent(wp, "orp_sensor", "OR", { calibrationSolutionMv: 470 });
      }
      ids.disinfection = addComponent(wp, index % 3 === 0 ? "electrolysis" : "chlorine_dosing_pump", "DS", { protectionFlowSensorId: ids.flow });
      ids.temperature = addComponent(wp, "temperature_sensor", "TP", { regulation: index % 2 ? "heating" : "heating_and_cooling" });
      ids.level = addComponent(wp, "level_sensor", "LC", { application: "water_project", sensing: "pressure" });
      ids.fillValve = addComponent(wp, "fill_valve", "FV", { normallyClosed: true });

      data.filtrationProtocols.push({
        id: wp.id + "-FIL-01",
        waterProjectId: wp.id,
        filtrationPumpComponentId: ids.filterPump,
        protectionFlowSensorComponentId: ids.flow,
        pressureSensorComponentId: ids.pressure,
        cycles: [
          { sequence: 1, startLocalTime: "06:00", durationMinutes: 180, speedPercent: 75 },
          { sequence: 2, startLocalTime: "11:30", durationMinutes: 120, speedPercent: 55 },
          { sequence: 3, startLocalTime: "17:00", durationMinutes: 180, speedPercent: 70 },
          { sequence: 4, startLocalTime: "23:00", durationMinutes: 60, speedPercent: 40 }
        ],
        backwash: { enabled: true, frequencyDays: 7, durationSeconds: 120, rinseSeconds: 45 }
      });

      function addControl(parameter, sensorId, setpoint, alarmLow, correctLow, correctHigh, alarmHigh) {
        if (!sensorId) return;
        data.measurementControls.push({
          id: wp.id + "-CTL-" + parameter,
          waterProjectId: wp.id,
          parameter: parameter,
          sensorComponentId: sensorId,
          setpoint: setpoint,
          alarmLow: alarmLow,
          correctLow: correctLow,
          correctHigh: correctHigh,
          alarmHigh: alarmHigh,
          offset: 0,
          alarmProfileId: "ALARM-STANDARD"
        });
      }

      addControl("ph", ids.ph, 7.25, 6.8, 7.0, 7.5, 7.7);
      addControl("freeChlorine", ids.fc, 1.2, 0.3, 0.6, 1.8, 3.0);
      addControl("orp", ids.orp, 720, 600, 650, 780, 850);
      addControl("temperature", ids.temperature, index % 2 ? 29 : 26, 18, 22, 30, 34);
      addControl("pressure", ids.pressure, 1.45, 0.4, 0.7, 2.2, 3.0);
      addControl("flow", ids.flow, 21, 4, 8, 35, 42);
      addControl("level", ids.level, 72, 20, 35, 95, 100);
      if (ids.alka) addControl("alkalinity", ids.alka, 120, 40, 70, 160, 200);

      data.dosingProtocols.push(
        { id: wp.id + "-DOS-PH", waterProjectId: wp.id, parameter: "ph", dosingComponentId: ids.phPump, controllingSensorComponentId: ids.ph, mode: "automatic", intervalOnSeconds: 5, intervalOffSeconds: 60, protectionFlowSensorComponentId: ids.flow },
        { id: wp.id + "-DOS-DS", waterProjectId: wp.id, parameter: index % 3 === 0 ? "electrolysis" : "freeChlorine", dosingComponentId: ids.disinfection, controllingSensorComponentId: ids.fc, mode: "automatic", intervalOnSeconds: 5, intervalOffSeconds: 60, protectionFlowSensorComponentId: ids.flow }
      );
      if (ids.alka) {
        data.dosingProtocols.push({ id: wp.id + "-DOS-AL", waterProjectId: wp.id, parameter: "alkalinity", dosingComponentId: ids.alkaPump, controllingSensorComponentId: ids.alka, mode: "automatic", intervalOnSeconds: 8, intervalOffSeconds: 120, protectionFlowSensorComponentId: ids.flow });
      }

      data.levelControlProtocols.push(
        { id: wp.id + "-LVL-WP", waterProjectId: wp.id, application: "water_project", name: wp.name + " level", levelSensorComponentId: ids.level, fillValveComponentId: ids.fillValve, targetPercent: 72, maxFillMinutes: 15, maxCyclesPerDay: 4, waterCounterLitersPerDay: 780, totalWaterCounterLiters: 7580 },
        { id: wp.id + "-LVL-CHEM", waterProjectId: wp.id, application: "chemical_tank", name: (index % 2 ? "pH+" : "pH-") + " tank", levelSensorComponentId: ids.level, fillValveComponentId: null, targetPercent: 50, mixerRunMinutes: 15, repeatEveryMinutes: 45 }
      );

      var basePh = [7.28, 7.61, 7.18, 6.72, 7.31, 7.42, 7.05][index];
      var baseFc = [1.16, 0.48, 1.42, 0.22, 1.05, 2.25, 0.78][index];
      var baseOrp = ids.orp ? [731, 612, 746, 588, null, 794, 665][index] : null;
      data.telemetrySnapshots.push({
        id: wp.id + "-TEL-001",
        waterProjectId: wp.id,
        measuredAt: index === 3 || index === 4 ? ago(31 + index) : ago(0.1 + index * 0.17),
        sourceUnitId: wp.unitId,
        values: {
          ph: basePh,
          alkalinity: ids.alka ? [122, null, 96, null, 141, null, 74][index] : null,
          freeChlorine: baseFc,
          orp: baseOrp,
          temperature: [26.4, 31.2, 29.1, 18.5, 17.9, 24.8, 25.2][index],
          pressure: [1.44, 1.92, 1.32, 0.31, 0.78, 2.35, 1.15][index],
          flow: [24.2, 14.8, 19.4, 0, 6.1, 38.5, 28.2][index],
          level: [76, 54, 68, 31, 82, 96, 63][index]
        }
      });
    });

    data.notifications = [
      { id: "NTF-001", targetType: "waterProject", targetId: "WPR-002", unitId: "UNT-001", severity: "warning", code: "PH_HIGH", message: "pH is above the configured correction range.", occurredAt: ago(0.7) },
      { id: "NTF-002", targetType: "unit", targetId: "UNT-003", unitId: "UNT-003", severity: "critical", code: "UNIT_OFFLINE", message: "Unit has not communicated for more than 24 hours.", occurredAt: ago(7) },
      { id: "NTF-003", targetType: "waterProject", targetId: "WPR-004", unitId: "UNT-003", severity: "critical", code: "FLOW_LOSS", message: "No filtration flow detected.", occurredAt: ago(31) },
      { id: "NTF-004", targetType: "waterProject", targetId: "WPR-006", unitId: "UNT-004", severity: "warning", code: "FC_HIGH", message: "Free chlorine is above the correction range.", occurredAt: ago(1.5) },
      { id: "NTF-005", targetType: "waterProject", targetId: "WPR-007", unitId: "UNT-005", severity: "info", code: "CALIBRATION_DUE", message: "ORP sensor calibration is due in seven days.", occurredAt: ago(12) }
    ];
    data.notificationAcknowledgements.push({
      id: "ACK-001",
      notificationId: "NTF-005",
      action: "acknowledge",
      actorId: "USR-INSTALLER",
      actorName: "Service Operator",
      occurredAt: ago(2)
    });
    data.firmwareUpdates = [
      { id: "FWU-001", unitId: "UNT-003", fromVersion: "4.7.9", toVersion: "4.8.2", state: "available", progressPercent: 0, requestedAt: null, completedAt: null }
    ];
    return data;
  }

  function findById(collection, id) {
    return collection.find(function (item) { return item.id === id; }) || null;
  }

  function findAll(collection, field, value) {
    return collection.filter(function (item) { return item[field] === value; });
  }

  function customerForLocation(location) {
    return location ? findById(db.customers, location.customerId) : null;
  }

  function locationForProject(project) {
    return project ? findById(db.locations, project.locationId) : null;
  }

  function projectForUnit(unit) {
    return unit ? findById(db.projects, unit.projectId) : null;
  }

  function unitForWaterProject(wp) {
    return wp ? findById(db.units, wp.unitId) : null;
  }

  function contextForUnit(unit) {
    var project = projectForUnit(unit);
    var location = locationForProject(project);
    return { unit: unit, project: project, location: location, customer: customerForLocation(location) };
  }

  function contextForWaterProject(wp) {
    var unit = unitForWaterProject(wp);
    var context = contextForUnit(unit);
    context.waterProject = wp;
    return context;
  }

  function projectsForLocation(locationId) {
    return findAll(db.projects, "locationId", locationId);
  }

  function unitsForProject(projectId) {
    return findAll(db.units, "projectId", projectId);
  }

  function waterProjectsForUnit(unitId) {
    return findAll(db.waterProjects, "unitId", unitId);
  }

  function unitsForLocation(locationId) {
    var projectIds = projectsForLocation(locationId).map(function (item) { return item.id; });
    return db.units.filter(function (unit) { return projectIds.indexOf(unit.projectId) !== -1; });
  }

  function waterProjectsForProject(projectId) {
    var unitIds = unitsForProject(projectId).map(function (item) { return item.id; });
    return db.waterProjects.filter(function (wp) { return unitIds.indexOf(wp.unitId) !== -1; });
  }

  function latestTelemetry(waterProjectId) {
    return db.telemetrySnapshots
      .filter(function (item) { return item.waterProjectId === waterProjectId; })
      .sort(function (a, b) { return b.measuredAt.localeCompare(a.measuredAt); })[0] || null;
  }

  function controlsForWaterProject(waterProjectId) {
    return findAll(db.measurementControls, "waterProjectId", waterProjectId);
  }

  function controlFor(waterProjectId, parameter) {
    return controlsForWaterProject(waterProjectId).find(function (item) { return item.parameter === parameter; }) || null;
  }

  function allocationsForWaterProject(waterProjectId) {
    return findAll(db.componentAllocations, "waterProjectId", waterProjectId);
  }

  function componentsForWaterProject(waterProjectId) {
    var componentIds = allocationsForWaterProject(waterProjectId).map(function (item) { return item.componentId; });
    return db.unitComponents.filter(function (item) { return componentIds.indexOf(item.id) !== -1; });
  }

  function componentsForUnit(unitId) {
    return findAll(db.unitComponents, "unitId", unitId);
  }

  function waterProjectsForComponent(componentId) {
    return findAll(db.componentAllocations, "componentId", componentId)
      .map(function (allocation) { return findById(db.waterProjects, allocation.waterProjectId); })
      .filter(Boolean);
  }

  function portForComponent(componentId) {
    var assignment = findAll(db.componentPortAssignments, "componentId", componentId)[0];
    return assignment ? findById(db.physicalPorts, assignment.portId) : null;
  }

  function moduleForComponent(componentId) {
    var allocation = findAll(db.unitModuleAllocations, "componentId", componentId)[0];
    return allocation ? findById(db.unitModules, allocation.moduleId) : null;
  }

  function latestAcknowledgement(notificationId) {
    return db.notificationAcknowledgements
      .filter(function (item) { return item.notificationId === notificationId; })
      .sort(function (a, b) { return b.occurredAt.localeCompare(a.occurredAt); })[0] || null;
  }

  function isAcknowledged(notification) {
    var event = latestAcknowledgement(notification.id);
    return Boolean(event && event.action === "acknowledge");
  }

  function notificationsForUnit(unitId) {
    return db.notifications.filter(function (item) { return item.unitId === unitId; });
  }

  function notificationsForWaterProject(waterProjectId) {
    return db.notifications.filter(function (item) {
      return item.targetType === "waterProject" && item.targetId === waterProjectId;
    });
  }

  function openNotifications() {
    return db.notifications.filter(function (item) { return !isAcknowledged(item); });
  }

  function unitStatus(unit) {
    var lastSeenHours = (Date.now() - new Date(unit.communication.lastSeenAt).getTime()) / 3600000;
    if (!unit.communication.connected || lastSeenHours >= 24) return "offline";
    var active = notificationsForUnit(unit.id).filter(function (item) {
      return !isAcknowledged(item) && (item.severity === "warning" || item.severity === "critical");
    });
    return active.length ? "alert" : "online";
  }

  function classifyValue(control, value) {
    if (value === null || value === undefined || !control) return "unknown";
    if (value <= control.alarmLow || value >= control.alarmHigh) return "danger";
    if (value < control.correctLow || value > control.correctHigh) return "warn";
    return "success";
  }

  function sensorMode(wpId) {
    var hasFc = Boolean(controlFor(wpId, "freeChlorine"));
    var hasOrp = Boolean(controlFor(wpId, "orp"));
    if (hasFc && hasOrp) return "FC + ORP";
    if (hasFc) return "FC";
    if (hasOrp) return "ORP";
    return "Not configured";
  }

  function validateDb(data) {
    var errors = [];
    var collections = [
      "customers", "users", "locations", "projects", "units", "waterProjects", "unitModules",
      "physicalPorts", "unitComponents", "unitModuleAllocations", "componentPortAssignments",
      "componentAllocations", "telemetrySnapshots", "filtrationProtocols", "measurementControls",
      "dosingProtocols", "levelControlProtocols", "notifications", "notificationAcknowledgements",
      "firmwareUpdates", "commands"
    ];
    collections.forEach(function (name) {
      var ids = {};
      (data[name] || []).forEach(function (item) {
        if (!item.id) errors.push(name + " contains an item without an id");
        if (ids[item.id]) errors.push("Duplicate id " + item.id + " in " + name);
        ids[item.id] = true;
      });
    });
    function requireRef(collectionName, field, targetName) {
      var targets = {};
      (data[targetName] || []).forEach(function (item) { targets[item.id] = true; });
      (data[collectionName] || []).forEach(function (item) {
        if (item[field] !== null && item[field] !== undefined && !targets[item[field]]) {
          errors.push(collectionName + "." + field + " references missing " + targetName + " id " + item[field]);
        }
      });
    }
    requireRef("locations", "customerId", "customers");
    requireRef("projects", "locationId", "locations");
    requireRef("units", "projectId", "projects");
    requireRef("waterProjects", "unitId", "units");
    requireRef("unitModules", "unitId", "units");
    requireRef("physicalPorts", "unitId", "units");
    requireRef("unitComponents", "unitId", "units");
    requireRef("unitModuleAllocations", "moduleId", "unitModules");
    requireRef("unitModuleAllocations", "componentId", "unitComponents");
    requireRef("componentPortAssignments", "componentId", "unitComponents");
    requireRef("componentPortAssignments", "portId", "physicalPorts");
    requireRef("componentAllocations", "componentId", "unitComponents");
    requireRef("componentAllocations", "waterProjectId", "waterProjects");
    requireRef("telemetrySnapshots", "waterProjectId", "waterProjects");
    requireRef("measurementControls", "waterProjectId", "waterProjects");
    requireRef("filtrationProtocols", "waterProjectId", "waterProjects");
    requireRef("notificationAcknowledgements", "notificationId", "notifications");

    var usedPorts = {};
    (data.componentPortAssignments || []).forEach(function (assignment) {
      if (usedPorts[assignment.portId]) errors.push("Physical port " + assignment.portId + " has multiple component assignments");
      usedPorts[assignment.portId] = assignment.componentId;
    });
    (data.componentAllocations || []).forEach(function (allocation) {
      var component = findById(data.unitComponents, allocation.componentId);
      var wp = findById(data.waterProjects, allocation.waterProjectId);
      if (component && wp && component.unitId !== wp.unitId) {
        errors.push("Component " + component.id + " is allocated across unit boundaries");
      }
    });
    (data.filtrationProtocols || []).forEach(function (protocol) {
      if (!protocol.cycles || protocol.cycles.length !== 4) {
        errors.push("Filtration protocol " + protocol.id + " must contain four cycles");
      }
    });
    (data.measurementControls || []).forEach(function (control) {
      if (Object.prototype.hasOwnProperty.call(control, "current")) {
        errors.push("Measurement control " + control.id + " duplicates a live telemetry value");
      }
    });
    (data.units || []).forEach(function (unit) {
      if (Object.prototype.hasOwnProperty.call(unit, "address")) {
        errors.push("Unit " + unit.id + " duplicates its Location address");
      }
    });
    (data.waterProjects || []).forEach(function (wp) {
      if (!(data.telemetrySnapshots || []).some(function (snapshot) { return snapshot.waterProjectId === wp.id; })) {
        errors.push("Water Project " + wp.id + " has no timestamped telemetry snapshot");
      }
    });
    (data.commands || []).forEach(function (command) {
      if (!command.requestedAt || !command.requestedBy || command.status !== "requested") {
        errors.push("Command " + command.id + " is missing its request audit fields");
      }
    });
    var parameterSets = (data.waterProjects || []).map(function (wp) {
      return (data.measurementControls || [])
        .filter(function (control) { return control.waterProjectId === wp.id; })
        .map(function (control) { return control.parameter; });
    });
    if (!parameterSets.some(function (set) { return set.indexOf("freeChlorine") !== -1 && set.indexOf("orp") !== -1; })) {
      errors.push("The configuration must support FC and ORP together");
    }
    if (!parameterSets.some(function (set) { return set.indexOf("alkalinity") === -1; })) {
      errors.push("The configuration must support optional ALKA equipment");
    }
    if (!data.configurationValues || typeof data.configurationValues !== "object" || Array.isArray(data.configurationValues)) {
      errors.push("Configuration values must be stored as an object");
    }
    var coverage = sourceCoverageReport();
    coverage.missing.forEach(function (record) {
      errors.push("Configuration field " + record.excelRow + " has no application section");
    });
    coverage.duplicateRows.forEach(function (row) {
      errors.push("Configuration field " + row + " occurs more than once");
    });
    return errors;
  }

  function loadDb() {
    try {
      var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (stored && stored.schemaVersion === SCHEMA_VERSION && validateDb(stored).length === 0) return stored;
    } catch (error) {
      console.warn("Ignoring invalid persisted installation state", error);
    }
    var fresh = createInstallationState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function saveDb() {
    integrityErrors = validateDb(db);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function appendCommand(options) {
    var command = {
      id: "CMD-" + String(db.commands.length + 1).padStart(4, "0"),
      unitId: options.unitId,
      waterProjectId: options.waterProjectId || null,
      targetType: options.targetType,
      targetId: options.targetId,
      commandType: options.commandType,
      label: options.label,
      status: "requested",
      requestedBy: "USR-INSTALLER",
      requestedByName: "Service Operator",
      requestedAt: nowIso()
    };
    db.commands.unshift(command);
    saveDb();
    showToast(options.label + " request added.");
    render();
  }

  function toggleAcknowledgement(notificationId) {
    var notification = findById(db.notifications, notificationId);
    if (!notification) return;
    db.notificationAcknowledgements.push({
      id: "ACK-" + String(db.notificationAcknowledgements.length + 1).padStart(4, "0"),
      notificationId: notificationId,
      action: isAcknowledged(notification) ? "reopen" : "acknowledge",
      actorId: "USR-INSTALLER",
      actorName: "Service Operator",
      occurredAt: nowIso()
    });
    saveDb();
    showToast(isAcknowledged(notification) ? "Notification acknowledged with audit event." : "Notification reopened with audit event.");
    render();
  }

  function scheduleFirmwareUpdate(unitId) {
    var unit = findById(db.units, unitId);
    if (!unit) return;
    var update = db.firmwareUpdates.find(function (item) { return item.unitId === unitId && item.state !== "completed"; });
    if (!update) {
      update = {
        id: "FWU-" + String(db.firmwareUpdates.length + 1).padStart(4, "0"),
        unitId: unitId,
        fromVersion: unit.firmwareVersion,
        toVersion: "4.8.2",
        state: "available",
        progressPercent: 0,
        requestedAt: null,
        completedAt: null
      };
      db.firmwareUpdates.push(update);
    }
    update.state = "scheduled";
    update.requestedAt = nowIso();
    appendCommand({ unitId: unitId, targetType: "unit", targetId: unitId, commandType: "firmware_update", label: "Firmware update to " + update.toVersion });
  }

  function resetInstallationState() {
    db = createInstallationState();
    saveDb();
    showToast("Installation data restored.");
    render();
  }

  db = loadDb();
  integrityErrors = validateDb(db);

  // VIEW LAYER

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function conciseObjectName(value) {
    var text = String(value === null || value === undefined ? "" : value).trim();
    var separator = text.indexOf(" · ");
    return separator === -1 ? text : text.slice(0, separator);
  }

  function componentDisplayName(component) {
    return component ? conciseObjectName(component.name) : "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-BE", { dateStyle: "medium" }).format(new Date(value));
  }

  function formatDateTime(value) {
    if (!value) return "—";
    return new Intl.DateTimeFormat("en-BE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function ageLabel(value) {
    if (!value) return "Never";
    var minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 2) return "Just now";
    if (minutes < 60) return minutes + " min ago";
    var hours = Math.round(minutes / 60);
    if (hours < 48) return hours + " h ago";
    return Math.round(hours / 24) + " d ago";
  }

  function formatAddress(location) {
    if (!location) return "—";
    var a = location.address;
    return [a.street + " " + a.houseNumber, a.postalCode + " " + a.city, a.countryCode].join(", ");
  }

  function formatValue(parameter, value) {
    var meta = PARAMS[parameter];
    if (!meta || value === null || value === undefined) return "—";
    return Number(value).toFixed(meta.decimals) + " " + meta.unit;
  }

  function statusChip(status) {
    if (status === "online") return '<span class="chip online">Online</span>';
    if (status === "offline") return '<span class="chip offline">Offline</span>';
    if (status === "alert") return '<span class="chip warn">Needs attention</span>';
    return '<span class="chip">' + esc(status) + "</span>";
  }

  function severityChip(severity) {
    var cls = severity === "critical" ? "danger" : severity === "warning" ? "warn" : "";
    return '<span class="chip ' + cls + '">' + esc(severity) + "</span>";
  }

  function pageHeader(title, subtitle, actions) {
    return '<div class="page-head"><div><h1 data-accent>' + esc(title) + '</h1><p class="muted">' + esc(subtitle || "") +
      '</p></div><div class="page-actions">' + (actions || "") + "</div></div>";
  }

  function crumbs(items) {
    return '<nav class="crumbs" aria-label="Breadcrumb">' + items.map(function (item, index) {
      var node = item.href ? '<a href="' + item.href + '">' + esc(item.label) + "</a>" : "<span>" + esc(item.label) + "</span>";
      return (index ? '<span class="sep">›</span>' : "") + node;
    }).join("") + "</nav>";
  }

  function emptyState(message) {
    return '<div class="empty-state">' + esc(message) + "</div>";
  }

  function table(headers, rows, className) {
    if (!rows.length) return emptyState("No matching records.");
    return '<div class="table-scroll"><table class="list ' + (className || "") + '"><thead><tr>' +
      headers.map(function (item) { return "<th>" + esc(item) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.join("") + "</tbody></table></div>";
  }

  function sourceText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function sourceRecordsWhere(predicate) {
    return (CONFIGURATION_SCHEMA.records || []).filter(predicate);
  }

  function sourceGroups(records, key) {
    var groups = [];
    var positions = {};
    records.forEach(function (record) {
      var value = sourceText(record[key]);
      var groupKey = value || "__blank__";
      if (positions[groupKey] === undefined) {
        positions[groupKey] = groups.length;
        groups.push({ value: value, records: [] });
      }
      groups[positions[groupKey]].records.push(record);
    });
    return groups;
  }

  function sourceSurfaceForRecord(record) {
    if (!record) return null;
    if (record.object === "User") return "users";
    if (record.object === "Location") return "location";
    if (record.object === "Project") return "project";
    if (record.object === "Unit") return "unit";
    if (record.object !== "Water Project") return null;
    if (record.category === "Info") return "waterproject-info";
    if (record.category === "Connections") return "waterproject-connections";
    if (record.category === "Protocol" || record.category === "Protocols") return "waterproject-protocols";
    if (record.category === "Notification") return "waterproject-notifications";
    return null;
  }

  function sourceCoverageReport() {
    var records = CONFIGURATION_SCHEMA.records || [];
    var seenRows = {};
    var duplicateRows = [];
    var missing = [];
    var surfaces = {};
    records.forEach(function (record) {
      var row = String(record.excelRow);
      if (seenRows[row]) duplicateRows.push(record.excelRow);
      seenRows[row] = true;
      var surface = sourceSurfaceForRecord(record);
      if (!surface) missing.push(record);
      else surfaces[surface] = (surfaces[surface] || 0) + 1;
    });
    var expected = Number(CONFIGURATION_SCHEMA.recordCount || records.length);
    return {
      expected: expected,
      records: records.length,
      mapped: records.length - missing.length,
      missing: missing,
      duplicateRows: duplicateRows,
      surfaces: surfaces,
      complete: records.length === expected && missing.length === 0 && duplicateRows.length === 0
    };
  }

  function sourceRecordsFor(objectName, categories) {
    return sourceRecordsWhere(function (record) {
      if (record.object !== objectName) return false;
      return !categories || categories.indexOf(record.category) !== -1;
    });
  }

  function sourceContextEntity(objectName, contextId) {
    var collections = {
      User: "users",
      Location: "locations",
      Project: "projects",
      Unit: "units",
      "Water Project": "waterProjects"
    };
    var collection = collections[objectName];
    return collection && db[collection] ? findById(db[collection], contextId) : null;
  }

  function sourceFieldValueKey(contextId, excelRow) {
    return String(contextId) + ":" + String(excelRow);
  }

  function sourceFieldSeed(record, entity) {
    if (!record || !entity) return "";
    var property = sourceText(record.propertyName).toLowerCase();
    var label = sourceText(record.label);
    if (record.object === "User") {
      if (label === "ID_R") return entity.id;
      if (label === "CoNAME") return entity.companyName;
      if (label === "NAME_R") return entity.name;
      if (label === "STNR_R") return entity.address.street + " " + entity.address.houseNumber;
      if (label === "PC_R") return entity.address.postalCode;
      if (label === "CTY_R") return entity.address.city;
      if (property === "country") return entity.address.country;
      if (label === "LC_R") return entity.address.countryCode;
      if (label === "TEL_R") return entity.telephone;
      if (label === "MAIL_R") return entity.email;
      if (label === "ALAMES_R") return entity.notificationChannel;
    }
    if (record.object === "Location") {
      if (property.indexOf("name") === 0) return entity.name;
      if (property.indexOf("street") === 0) return entity.address.street + " " + entity.address.houseNumber;
      if (property.indexOf("postal") === 0) return entity.address.postalCode;
      if (property === "town") return entity.address.city;
      if (property.indexOf("country") === 0) return entity.country || entity.address.countryCode;
      if (property.indexOf("land code") === 0) return entity.address.countryCode;
      if (property === "description") return entity.description || "";
    }
    if (record.object === "Project") {
      if (property === "name project") return entity.name;
      if (property === "project type") return entity.type || "General";
      if (property === "description") return entity.description;
    }
    if (record.object === "Unit") {
      if (label === "SS_GLG_Res") return entity.language;
      if (label === "SS_GTS_TZ") return entity.timeZone;
      if (label === "SS_GTS_Res") return new Date().toTimeString().slice(0, 5);
      if (label === "SS_GDATE_Res") return new Date().toISOString().slice(0, 10);
      if (label === "SS_U_NAME_RES") return entity.name;
      if (label === "SS_U_ID_RES") return entity.macAddress;
      if (label === "SS_U_SWR_RES") return entity.firmwareVersion;
      if (label === "SS_U_ST_RES") return entity.systemType || "i-Control";
      if (property === "working hours unit") return entity.workingHours;
      if (property === "installation date") return entity.installedAt;
      if (label === "SS_U_AL_SW") return entity.display.autoLockEnabled ? "On" : "Off";
      if (label === "SS_U_Dtime") return entity.display.lockAfterMinutes;
      if (label === "SS_U_D_LU") return "min";
      if (label === "SS_U_SL_SW" || label === "SS_U_SL_CODE") return entity.display.screenCodeConfigured ? "On" : "Off";
      if (label === "SS_U_Ddim") return entity.display.dimPercent;
      if (label === "SS_U_V_VSS") return entity.measurementSystem || "Metric (SI)";
      if (property === "unit updates available") return "Yes";
      if (property === "date last update") return entity.lastUpdateAt || entity.installedAt;
      if (label === "SS_U_LUNR") return entity.name;
      if (label === "SS_U_LSNR" || label === "SS_U_LPCR" || label === "SS_U_LCitR" || label === "SS_U_LCRR" || label === "SS_U_LLCR") {
        var context = contextForUnit(entity);
        if (label === "SS_U_LSNR") return context.location.address.street + " " + context.location.address.houseNumber;
        if (label === "SS_U_LPCR") return context.location.address.postalCode;
        if (label === "SS_U_LCitR") return context.location.address.city;
        return context.location.address.countryCode;
      }
      if (property === "network") return entity.communication.connected ? "On" : "Off";
      if (property === "bluetooth") return entity.communication.bluetoothEnabled ? "On" : "Off";
      if (property.indexOf("inactivity") === 0) return Math.max(0, Math.round((Date.now() - new Date(entity.communication.lastSeenAt).getTime()) / 86400000));
    }
    if (record.object === "Water Project" && record.category === "Info") {
      if (label === "WP_NAME_R") return entity.name;
      if (label === "WP_PS_R") return entity.structure;
      if (label === "WP_PT_R") return entity.projectType || entity.usage;
      if (label === "WP_PC_R") return entity.conditions;
      if (label === "WP_Disc_R") return entity.description || "";
      if (label === "WP_Vol_R") return entity.volumeM3;
      if (label === "WP_Vol_U") return "m³";
      if (label === "WP_Sur_R") return entity.surfaceM2 || Number((entity.lengthM * entity.widthM).toFixed(1));
      if (label === "WP_Sur_U") return "m²";
    }
    return "";
  }

  function sourceFieldCurrentValue(record, contextId) {
    var key = sourceFieldValueKey(contextId, record.excelRow);
    if (Object.prototype.hasOwnProperty.call(db.configurationValues, key)) return db.configurationValues[key];
    return sourceFieldSeed(record, sourceContextEntity(record.object, contextId));
  }

  function applySourceFieldToEntity(record, entity, value) {
    if (!record || !entity) return;
    var property = sourceText(record.propertyName).toLowerCase();
    var label = sourceText(record.label);
    if (record.object === "User") {
      if (label === "CoNAME") entity.companyName = value;
      else if (label === "NAME_R") entity.name = value;
      else if (label === "MAIL_R") entity.email = value;
      else if (label === "TEL_R") entity.telephone = value;
      else if (label === "ALAMES_R") entity.notificationChannel = value;
    } else if (record.object === "Location") {
      if (property.indexOf("name") === 0) entity.name = value;
      else if (property.indexOf("postal") === 0) entity.address.postalCode = value;
      else if (property === "town") entity.address.city = value;
      else if (property.indexOf("land code") === 0) entity.address.countryCode = value;
      else if (property === "description") entity.description = value;
    } else if (record.object === "Project") {
      if (property === "name project") entity.name = value;
      else if (property === "project type") entity.type = value;
      else if (property === "description") entity.description = value;
    } else if (record.object === "Unit") {
      if (label === "SS_GLG_Res") entity.language = value;
      else if (label === "SS_GTS_TZ") entity.timeZone = value;
      else if (label === "SS_U_NAME_RES") entity.name = value;
      else if (label === "SS_U_ID_RES") entity.macAddress = value;
      else if (label === "SS_U_SWR_RES") entity.firmwareVersion = value;
      else if (label === "SS_U_ST_RES") entity.systemType = value;
      else if (property === "working hours unit") entity.workingHours = Number(value) || 0;
      else if (property === "installation date") entity.installedAt = value;
      else if (label === "SS_U_AL_SW") entity.display.autoLockEnabled = String(value).toLowerCase() === "on";
      else if (label === "SS_U_Dtime") entity.display.lockAfterMinutes = Number(value) || 0;
      else if (label === "SS_U_Ddim") entity.display.dimPercent = Number(value) || 0;
      else if (label === "SS_U_V_VSS") entity.measurementSystem = value;
      else if (property === "network") entity.communication.connected = String(value).toLowerCase() === "on";
      else if (property === "bluetooth") entity.communication.bluetoothEnabled = String(value).toLowerCase() === "on";
    } else if (record.object === "Water Project" && record.category === "Info") {
      if (label === "WP_NAME_R") entity.name = value;
      else if (label === "WP_PS_R") entity.structure = value;
      else if (label === "WP_PT_R") entity.projectType = value;
      else if (label === "WP_PC_R") entity.conditions = value;
      else if (label === "WP_Disc_R") entity.description = value;
      else if (label === "WP_Vol_R") entity.volumeM3 = Number(value) || 0;
      else if (label === "WP_Sur_R") entity.surfaceM2 = Number(value) || 0;
    }
  }

  function sourceFieldOptions(record) {
    var dataType = sourceText(record.dataType).toLowerCase();
    var unit = sourceText(record.unit);
    if (dataType.indexOf("boolean") !== -1 || dataType === "on / off" || dataType === "on/off") {
      return /yes\s*,\s*no/i.test(unit) ? ["Yes", "No"] : ["On", "Off"];
    }
    var knownLists = [
      /^off\s*,\s*mail\s*,\s*sms$/i,
      /^metric \(si\)\s*,\s*us \(imperial\)$/i,
      /^i-control\s*,\s*i-plug-in$/i,
      /^high\s*,\s*low$/i,
      /^ignore\s*,\s*notification\s*,\s*stop \+ notification$/i,
      /^indoor\s*,\s*outdoor$/i
    ];
    if (knownLists.some(function (pattern) { return pattern.test(unit); })) {
      return unit.split(",").map(function (item) { return item.trim(); });
    }
    return [];
  }

  function sourceInputType(record) {
    var property = sourceText(record.propertyName).toLowerCase();
    var dataType = sourceText(record.dataType).toLowerCase();
    if (property === "timezone") return "text";
    if (dataType === "date") return "date";
    if (dataType === "time" || dataType.indexOf("hh:mm") !== -1 || (dataType.indexOf("tijd") !== -1 && property === "time")) return "time";
    if (dataType === "number" || dataType === "hr" || dataType === "code vae") return "number";
    return "text";
  }

  function renderSourceFieldControl(record, contextId) {
    var value = sourceFieldCurrentValue(record, contextId);
    var options = sourceFieldOptions(record);
    var id = "source-field-" + String(contextId).replace(/[^a-z0-9_-]/gi, "-") + "-" + record.excelRow;
    var hint = configurationFieldHint(record);
    var attributes = ' id="' + esc(id) + '" data-source-field data-context="' + esc(contextId) + '" data-row="' + esc(record.excelRow) + '"' +
      (hint ? ' aria-describedby="' + esc(id) + '-hint"' : "");
    if (options.length) {
      return '<select' + attributes + '><option value="">Not set</option>' + options.map(function (option) {
        return '<option value="' + esc(option) + '"' + (String(value).toLowerCase() === option.toLowerCase() ? " selected" : "") + ">" + esc(option) + "</option>";
      }).join("") + "</select>";
    }
    var type = sourceInputType(record);
    var maxLength = Number(record.maxLength);
    var maxLengthAttribute = type === "text" && Number.isFinite(maxLength) && maxLength > 0 ? ' maxlength="' + maxLength + '"' : "";
    var placeholder = configurationFieldHint(record) || "Enter value";
    var useTextarea = type === "text" && (/description|information|parameters/i.test(sourceText(record.propertyName)) || maxLength > 120);
    if (useTextarea) return '<textarea' + attributes + maxLengthAttribute + ' placeholder="' + esc(placeholder) + '">' + esc(value) + "</textarea>";
    return '<input' + attributes + ' type="' + type + '"' + (type === "number" ? ' step="any"' : "") + maxLengthAttribute +
      ' value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" />';
  }

  function configurationFieldName(record) {
    var raw = sourceText(record.propertyName) || "Setting";
    var labels = {
      "e-Mail": "Email",
      "Push messages alarm": "Alarm notifications",
      "Name (Location/company)": "Location name",
      "Land Code Loction": "Country code",
      "Name Project": "Project name",
      "Name Water Project": "Water Project name",
      "Timezone": "Time zone",
      "Unit-MAC-ID": "MAC address",
      "Software versions (of the unit)": "Software version",
      "Working hours UNIT": "Working hours",
      "WiFi Settings": "Wi-Fi settings",
      "LAN Settings": "Ethernet settings",
      "Inactivity (hoe lang heeft hij geen communicatie met unit?)": "Offline duration",
      "Flow (through bricontact)": "Flow protection contact",
      "beëindigen alarm": "Close alarm",
      "beëindigen warnings": "Close warnings",
      "Add conpressor": "Add compressor",
      "Proiority": "Priority"
    };
    var name = labels[raw] || raw;
    if (raw === "Screen lock code" && sourceText(record.dataType).toLowerCase().indexOf("boolean") !== -1) name = "Screen lock";
    return name.replace(/Nr°/g, "port").replace(/^Use\s+/i, "Enable ");
  }

  function configurationFieldHint(record) {
    if (sourceFieldOptions(record).length) return "";
    var unit = sourceText(record.unit);
    var measurementUnit = /^(?:%|pH|ppm|ppb|mV|V|mA|A|bar|psi|°C|°F|m3|m³|m2|m²|m|cm|mm|l|ml|l\/h|m3\/h|m³\/h|kg\/m3|kg\/m³|g\/l|rpm|Hz|kW|W|sec|seconds?|min|minutes?|h|hours?|days?|weeks?|months?|years?|HH:MM)$/i;
    return measurementUnit.test(unit) ? unit : "";
  }

  function functionalGroupDescription(label) {
    var descriptions = {
      "Account": "Identity and ownership",
      "Contact details": "Ways to reach this user",
      "Address": "Postal and regional information",
      "Notifications": "Delivery preferences",
      "Site identity": "Location naming and notes",
      "Project details": "Identity, type and description",
      "Locale & time": "Regional controller preferences",
      "Controller identity": "Hardware and installation details",
      "Display & access": "Screen behavior and security",
      "Units & values": "Measurement presentation",
      "Software updates": "Update availability and history",
      "Modules & allocation": "Installed modules and Water Project assignment",
      "Reset & recovery": "Controller recovery actions",
      "Installation site": "Site details shown by the controller",
      "Connectivity": "Network, Bluetooth and offline monitoring",
      "General information": "Water Project identity",
      "Structure & use": "Type, conditions and description",
      "Dimensions": "Volume and surface settings",
      "Flow protection": "Safety input and flow interlock",
      "Input assignment": "Controller input selection",
      "Pumps": "Identity, allocation and output setup",
      "Pump testing": "Manual run and speed checks",
      "Automatic backwash": "Valve, air and filtration links",
      "Pressure sensing": "Sensor identity and input assignment",
      "Flow sensing": "Sensor identity, input and delay",
      "Air control": "Air output and backwash assignment",
      "Compressor control": "Compressor function, protection and test",
      "Water quality sensors": "pH and alkalinity measurement hardware",
      "pH dosing": "Pump setup, flow protection and sensor link",
      "Disinfection sensors": "Sensor setup, allocation and testing",
      "Disinfection equipment": "Dosing and electrolysis hardware",
      "Level sensing": "Level sensor application and input",
      "Water fill control": "Fresh-water counter and valve",
      "Tank mixing": "Chemical tank mixer and pump link",
      "Pressure level calibration": "Liquid density, offsets and range",
      "Level thresholds": "Very low through very high limits",
      "Temperature sensing": "Sensor placement, input and test",
      "Heating & cooling": "Output, application and regulation",
      "Pump operation": "Modes, schedules and speeds",
      "Pump speed profiles": "Special operating speeds",
      "Backwash": "Backwash schedule and sequence",
      "Pressure monitoring": "Live values, limits and calibration",
      "Flow monitoring": "Live values, limits and calibration",
      "pH measurement & calibration": "Setpoints, alarms and calibration",
      "pH dosing & maintenance": "Dosing cycles and service history",
      "Alkalinity measurement": "Setpoints, alarms and dosing feedback",
      "Alkalinity dosing": "Dose control and maintenance",
      "Disinfection measurement": "Sensor values, alarms and setpoints",
      "Sensor selection": "Choose the controlling disinfection sensor",
      "Free chlorine calibration": "Sensor service and reference measurement",
      "ORP calibration": "Inline calibration progress",
      "Dosing control": "Intervals, protection and maintenance",
      "Electrolysis control": "Production, boost and protection",
      "Disinfection strategy": "Select the active treatment strategy",
      "Shared protection": "Protection shared by dosing and electrolysis",
      "Temperature control": "Setpoint, alarms and equipment status",
      "Level monitoring": "Sensor application and current level",
      "Water refill": "Valve, counter and fill limits",
      "Chemical refill": "Tank refill and maintenance",
      "Tank mixing & alarms": "Mixer cycles, alarms and refill volume",
      "Alarms": "Alarm state and closing behavior",
      "Warnings": "Warning state and closing behavior"
    };
    return descriptions[label] || "Related configuration settings";
  }

  function functionalGroupForRecord(record) {
    var objectName = sourceText(record.object);
    var category = sourceText(record.category);
    var subcategory = sourceText(record.subcategory);
    var sub = sourceText(record.subSubcategory);
    var topic = sourceText(record.topic);
    var subtopic = sourceText(record.subtopic);
    var property = sourceText(record.propertyName).toLowerCase();
    var label = "General settings";

    if (objectName === "User") {
      if (/e-mail|push|alarm/.test(property)) label = "Notifications";
      else if (/street|postal|city|country|landcode/.test(property)) label = "Address";
      else if (/telephone/.test(property)) label = "Contact details";
      else label = "Account";
    } else if (objectName === "Location") {
      if (/street|postal|town|country|land code/.test(property)) label = "Address";
      else label = "Site identity";
    } else if (objectName === "Project") {
      label = "Project details";
    } else if (objectName === "Unit") {
      if (subcategory === "Communication") label = "Connectivity";
      else if (!sub || (subcategory === "General" && sub === "General")) label = "Locale & time";
      else if (sub === "General") label = "Controller identity";
      else if (sub === "Display") label = "Display & access";
      else if (sub === "Value") label = "Units & values";
      else if (sub === "Update") label = "Software updates";
      else if (sub === "Module") label = "Modules & allocation";
      else if (sub === "Reset") label = "Reset & recovery";
      else if (sub === "Location") label = "Installation site";
    } else if (objectName === "Water Project" && category === "Info") {
      if (subcategory === "Structure") label = "Structure & use";
      else if (subcategory === "Dimensions") label = "Dimensions";
      else label = "General information";
    } else if (objectName === "Water Project" && category === "Connections") {
      if (subcategory === "Level Control") {
        if (!sub) label = "Level sensing";
        else if (sub === "Tank/Project") label = "Water fill control";
        else if (sub.indexOf("Tank/Project/") === 0 && subtopic === "Level definition") label = "Level thresholds";
        else if (sub.indexOf("Tank/Project/") === 0) label = "Pressure level calibration";
        else label = "Tank mixing";
      } else if (subcategory === "Temperature, Heating & Cooling") {
        label = topic === "Heating/Cooling" ? "Heating & cooling" : "Temperature sensing";
      } else if (sub.indexOf("I-Plug in") === 0) label = "Flow protection";
      else if (sub === "I-Plugg inn") label = "Input assignment";
      else if (sub === "Pumps") label = "Pumps";
      else if (sub === "i-backwash") label = "Automatic backwash";
      else if (sub === "i-Pressure Sensor") label = "Pressure sensing";
      else if (sub === "i-Flow") label = "Flow sensing";
      else if (sub === "i-Air") label = "Air control";
      else if (sub === "i-Control") label = "Compressor control";
      else if (sub.toLowerCase() === "sensor") label = subcategory === "Water stability" ? "Water quality sensors" : "Disinfection sensors";
      else if (sub === "pH dosage") label = "pH dosing";
      else if (sub === "ALKA dosage") label = "Alkalinity dosing";
      else if (sub === "Disinfection technology") label = "Disinfection equipment";
      else label = "Pump testing";
    } else if (objectName === "Water Project" && (category === "Protocol" || category === "Protocols")) {
      if (subcategory === "Filtration and circulation") {
        if (subtopic === "General PRO") label = "Pump speed profiles";
        else if (subtopic === "Backwash") label = "Backwash";
        else if (subtopic === "i-pressure sensor") label = "Pressure monitoring";
        else if (subtopic.indexOf("i-flow") === 0) label = "Flow monitoring";
        else label = "Pump operation";
      } else if (subcategory === "Water stability") {
        if (sub === "pH measurement") label = "pH measurement & calibration";
        else if (sub === "pH dosage") label = "pH dosing & maintenance";
        else if (sub === "ALKA measurement") label = "Alkalinity measurement";
        else label = "Alkalinity dosing";
      } else if (subcategory === "Water disinfection") {
        if (topic === "FCL calibration") label = "Free chlorine calibration";
        else if (topic === "ORP calibration") label = "ORP calibration";
        else if (topic === "FCL + ORP") label = "Sensor selection";
        else if (topic.toLowerCase() === "dosing") label = "Dosing control";
        else if (topic === "Electrolyse") label = "Electrolysis control";
        else if (topic === "Dosing + Electrolyse") label = "Shared protection";
        else if (sub === "Disinfection technology") label = "Disinfection strategy";
        else label = "Disinfection measurement";
      } else if (subcategory === "Temperature") {
        label = "Temperature control";
      } else if (subcategory === "Level Control") {
        if (sub === "Tank/Project" && topic === "Float + Pressure") label = "Water refill";
        else if (sub && sub.indexOf("Tank/Project/") === 0) label = "Chemical refill";
        else if (sub && sub.indexOf("pH-") === 0) label = "Tank mixing & alarms";
        else label = "Level monitoring";
      }
    } else if (objectName === "Water Project" && category === "Notification") {
      label = subtopic === "Warnings" ? "Warnings" : "Alarms";
    }
    return { key: label, label: label, description: functionalGroupDescription(label) };
  }

  function renderSourceField(record, contextId) {
    var fieldName = configurationFieldName(record);
    var fieldId = "source-field-" + String(contextId).replace(/[^a-z0-9_-]/gi, "-") + "-" + record.excelRow;
    var hint = configurationFieldHint(record);
    return '<article class="source-field" data-source-row="' + esc(record.excelRow) + '" data-source-surface="' + esc(sourceSurfaceForRecord(record)) + '">' +
      '<div class="source-field-head"><label for="' + esc(fieldId) + '">' + esc(fieldName) + "</label></div>" +
      renderSourceFieldControl(record, contextId) + (hint ? '<p class="source-field-hint" id="' + esc(fieldId) + '-hint">' + esc(hint) + "</p>" : "") + "</article>";
  }

  function renderSourceFieldCollection(records, contextId, options) {
    options = options || {};
    var allRecords = records.slice().sort(function (a, b) { return a.excelRow - b.excelRow; });
    var visibleRecords = searchQuery ? allRecords.filter(function (record) {
      return matchesSearch([record.propertyName, record.label, record.dataType, record.unit, record.category, record.subcategory, record.subSubcategory, record.topic, record.subtopic, record.subSubtopic]);
    }) : allRecords;
    var groups = [];
    var groupIndex = {};
    visibleRecords.forEach(function (record) {
      var functionalGroup = functionalGroupForRecord(record);
      var key = functionalGroup.key;
      if (groupIndex[key] === undefined) {
        groupIndex[key] = groups.length;
        groups.push({ key: key, label: functionalGroup.label, description: functionalGroup.description, records: [] });
      }
      groups[groupIndex[key]].records.push(record);
    });
    var title = options.title || "Configuration";
    var description = options.description || "Manage the settings for this section.";
    var tag = options.embedded ? "div" : "section";
    var body = groups.length ? '<div class="source-field-groups">' + groups.map(function (group, index) {
      return '<details class="source-field-group"' + (options.openFirst && index === 0 ? " open" : "") + '><summary><span><strong>' +
        esc(group.label) + '</strong><small>' + esc(group.description) + '</small></span><span class="section-count">' + group.records.length +
        (group.records.length === 1 ? " setting" : " settings") + '</span></summary><div class="source-field-grid">' +
        group.records.map(function (record) { return renderSourceField(record, contextId); }).join("") + "</div></details>";
    }).join("") + "</div>" : emptyState(searchQuery ? "No settings match the search." : "No settings are available.");
    return "<" + tag + ' class="source-contract' + (options.embedded ? " embedded" : " section") + '"><div class="source-contract-head"><div><' +
      (options.embedded ? "h3" : "h2") + ">" + esc(title) + "</" + (options.embedded ? "h3" : "h2") + '><p class="muted">' + esc(description) +
      "</p></div></div>" + body + "</" + tag + ">";
  }

  function sectionIcon(icon) {
    var paths = {
      filtration: '<path d="M5 8a8 8 0 0 1 13.5-2L20 8"/><path d="m20 4v4h-4"/><path d="M19 16a8 8 0 0 1-13.5 2L4 16"/><path d="m4 20v-4h4"/><path d="M12 8.5c-1.8 2.2-2.7 3.7-2.7 5a2.7 2.7 0 0 0 5.4 0c0-1.3-.9-2.8-2.7-5Z"/>',
      stability: '<path d="M12 2.5S5.5 9.2 5.5 14.2a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2.5 12 2.5Z"/><path d="M9 13h6M10.5 16h3"/>',
      disinfection: '<path d="M12 3 19 6v5c0 4.6-2.8 8.3-7 10-4.2-1.7-7-5.4-7-10V6l7-3Z"/><path d="M12 8v6M9 11h6"/>',
      level: '<path d="M5 3h14v18H5z"/><path d="M7 14c1.1 0 1.6-.8 2.7-.8s1.6.8 2.7.8 1.6-.8 2.7-.8 1.6.8 2.9.8M8 7h8"/>',
      temperature: '<path d="M10 14.8V5a2 2 0 0 1 4 0v9.8a4 4 0 1 1-4 0Z"/><path d="M12 8v8"/>',
      schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>'
    };
    if (!paths[icon]) return "";
    return '<span class="accordion-icon icon-' + icon + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" focusable="false">' +
      paths[icon] + "</svg></span>";
  }

  function sectionIconName(title) {
    var key = String(title || "").toLowerCase();
    if (key.indexOf("filtration") !== -1 || key.indexOf("circulation") !== -1) return "filtration";
    if (key.indexOf("stability") !== -1) return "stability";
    if (key.indexOf("disinfection") !== -1 || key.indexOf("desinfection") !== -1) return "disinfection";
    if (key.indexOf("level") !== -1) return "level";
    if (key.indexOf("temperature") !== -1 || key.indexOf("heating") !== -1 || key.indexOf("cooling") !== -1) return "temperature";
    if (key.indexOf("schedul") !== -1) return "schedule";
    return "";
  }

  function sectionDisplayTitle(title) {
    var labels = {
      "Filtration and circulation": "Filtration and circulation",
      "Water stability": "Water stability",
      "Water Desinfection": "Water disinfection",
      "Water disinfection": "Water disinfection",
      "Level Control": "Level control",
      "Temperature, Heating & Cooling": "Temperature, heating & cooling",
      "Temperature": "Temperature"
    };
    return labels[title] || title || "General";
  }

  function renderAccordionSection(title, subtitle, badges, body, nested, iconName) {
    var badgeHtml = (badges || []).map(function (badge) {
      return '<span class="accordion-badge">' + esc(badge) + "</span>";
    }).join("");
    var iconHtml = nested ? "" : sectionIcon(iconName);
    var metaHtml = badgeHtml ? '<span class="accordion-meta">' + badgeHtml + "</span>" : "";
    return '<details class="accordion-section' + (nested ? " nested" : "") + (iconHtml ? " has-icon" : "") + '">' +
      '<summary><span class="accordion-arrow" aria-hidden="true">›</span>' + iconHtml +
      '<span class="accordion-label"><strong>' + esc(title) + "</strong>" +
      (subtitle ? "<small>" + esc(subtitle) + "</small>" : "") + "</span>" + metaHtml +
      '</summary><div class="accordion-panel">' + body + "</div></details>";
  }

  function matchesSearch(values) {
    if (!searchQuery) return true;
    return values.filter(Boolean).join(" ").toLowerCase().indexOf(searchQuery) !== -1;
  }

  function unitSearchValues(unit) {
    var c = contextForUnit(unit);
    return [unit.id, unit.name, unit.code, unit.macAddress, c.project && c.project.name, c.location && c.location.name, c.customer && c.customer.name];
  }

  function wpSearchValues(wp) {
    var c = contextForWaterProject(wp);
    return [wp.id, wp.name, wp.code, wp.structure, c.unit && c.unit.name, c.project && c.project.name, c.location && c.location.name, c.customer && c.customer.name];
  }

  function renderParamBadges(wp, limit) {
    var telemetry = latestTelemetry(wp.id);
    if (!telemetry) return emptyState("No telemetry snapshot.");
    var controls = controlsForWaterProject(wp.id);
    var visibleControls = limit ? controls.slice(0, limit) : controls;
    return '<div class="param-badges">' + visibleControls.map(function (control) {
      var value = telemetry.values[control.parameter];
      var state = classifyValue(control, value);
      return '<div class="param ' + (state === "success" ? "" : state) + '" title="Latest telemetry · ' + esc(formatDateTime(telemetry.measuredAt)) + '">' +
        '<span class="lbl">' + esc(PARAMS[control.parameter].label) + '</span><span class="val">' +
        esc(formatValue(control.parameter, value)) + "</span></div>";
    }).join("") + (limit && controls.length > limit ? '<span class="param-more">+' + (controls.length - limit) + " more</span>" : "") + "</div>";
  }

  function objectIcon(type) {
    var paths = {
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      location: '<path d="M12 21s7-6.1 7-12A7 7 0 1 0 5 9c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/>',
      project: '<path d="M3 6.5h7l2 2h9v10.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z"/><path d="M3 11h18"/>',
      unit: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
      water: '<path d="M12 2.5S5.5 9.2 5.5 14.2a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2.5 12 2.5Z"/><path d="M9 15.5c1.8 1.4 4.2 1.4 6 0"/>',
      system: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      connectivity: '<path d="M4.9 9.9a10 10 0 0 1 14.2 0M7.8 12.8a6 6 0 0 1 8.4 0M10.6 15.6a2 2 0 0 1 2.8 0"/><circle cx="12" cy="19" r="1"/>',
      firmware: '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 19h14"/>',
      equipment: '<path d="M14.5 6.5a4 4 0 0 0-5-5L12 4 9 7 6.5 4.5a4 4 0 0 0 5 5L4 17l3 3 7.5-7.5a4 4 0 0 0 5-5L17 10l-3-3 2.5-2.5"/>',
      notification: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>'
    };
    return '<span class="object-icon object-icon-' + esc(type) + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" focusable="false">' +
      (paths[type] || paths.system) + "</svg></span>";
  }

  function listItemIdentity(type, href, name, meta) {
    return '<div class="list-item-identity">' + objectIcon(type) + '<div class="list-item-copy"><a href="' + esc(href) + '">' +
      esc(name) + "</a>" + (meta ? '<div class="muted">' + esc(meta) + "</div>" : "") + "</div></div>";
  }

  function activeNotificationCount(records) {
    return records.filter(function (item) { return !isAcknowledged(item); }).length;
  }

  function notificationsForUnits(units) {
    var unitIds = units.map(function (unit) { return unit.id; });
    return db.notifications.filter(function (item) { return unitIds.indexOf(item.unitId) !== -1; });
  }

  function aggregateUnitStatus(units) {
    var statuses = units.map(unitStatus);
    if (statuses.indexOf("alert") !== -1) return "alert";
    if (statuses.indexOf("offline") !== -1) return "offline";
    return "online";
  }

  function overviewMetric(label, value) {
    return '<div class="overview-metric"><strong>' + esc(value) + '</strong><span>' + esc(label) + "</span></div>";
  }

  function detailFact(fact) {
    var value = fact.html !== undefined ? fact.html : fact.href ? '<a href="' + fact.href + '">' + esc(fact.value) + "</a>" : esc(fact.value);
    return '<div class="detail-fact"><span>' + esc(fact.label) + "</span><strong>" + value + "</strong></div>";
  }

  function detailSummaryCard(title, icon, facts, metrics, extraClass) {
    return '<article class="card detail-summary-card ' + (extraClass || "") + '"><div class="detail-card-head">' + objectIcon(icon) +
      '<h2>' + esc(title) + '</h2></div>' +
      (facts && facts.length ? '<div class="detail-facts">' + facts.map(detailFact).join("") + "</div>" : "") +
      (metrics && metrics.length ? '<div class="overview-metrics">' + metrics.map(function (metric) {
        return overviewMetric(metric.label, metric.value);
      }).join("") + "</div>" : "") + "</article>";
  }

  function renderNotifications(records, compact) {
    var filtered = records.filter(function (notification) {
      var target = notification.targetType === "unit" ? findById(db.units, notification.targetId) : findById(db.waterProjects, notification.targetId);
      return matchesSearch([notification.code, notification.message, target && target.name, notification.severity]);
    });
    var rows = filtered.sort(function (a, b) { return b.occurredAt.localeCompare(a.occurredAt); }).map(function (notification) {
      var target = notification.targetType === "unit" ? findById(db.units, notification.targetId) : findById(db.waterProjects, notification.targetId);
      var href = notification.targetType === "unit" ? "#/unit/" + notification.targetId : "#/waterproject/" + notification.targetId + "/notifications";
      var ack = latestAcknowledgement(notification.id);
      return "<tr>" +
        "<td>" + severityChip(notification.severity) + "</td>" +
        '<td><a href="' + href + '">' + esc(target ? target.name : notification.targetId) + "</a><div class=\"muted\">" + esc(notification.code) + "</div></td>" +
        "<td>" + esc(notification.message) + "</td>" +
        "<td>" + esc(formatDateTime(notification.occurredAt)) + "</td>" +
        "<td>" + (ack ? '<span class="chip ' + (isAcknowledged(notification) ? "success" : "warn") + '">' + (isAcknowledged(notification) ? "Acknowledged" : "Reopened") + "</span><div class=\"audit-meta\">" + esc(ack.actorName) + " · " + esc(formatDateTime(ack.occurredAt)) + "</div>" : '<span class="chip warn">Open</span>') + "</td>" +
        '<td><button class="btn secondary compact-btn" data-action="toggle-ack" data-id="' + notification.id + '">' + (isAcknowledged(notification) ? "Reopen" : "Acknowledge") + "</button></td>" +
        "</tr>";
    });
    return table(["Severity", "Target", "Message", "Occurred", "State / audit", ""], rows, compact ? "compact" : "");
  }

  function summaryIcon(type) {
    if (type === "total") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
    }
    if (type === "notifications") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5M12 17.2v.1"/></svg>';
    }
    if (type === "online") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 8.5"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>';
  }

  function summaryCard(title, tone, rows, href, featured) {
    var tag = href ? "a" : "article";
    return "<" + tag + ' class="overview-card tone-' + tone + (featured ? " featured" : "") + '"' +
      (href ? ' href="' + href + '"' : "") + '><div class="overview-card-title"><span class="summary-icon">' +
      summaryIcon(tone) + "</span><h2>" + esc(title) + '</h2></div><div class="overview-card-body">' +
      rows.map(function (row) {
        return '<div class="summary-row"><span>' + esc(row.label) + "</span><strong>" + esc(row.value) + "</strong></div>";
      }).join("") + "</div></" + tag + ">";
  }

  function dashboardView() {
    var visibleWps = db.waterProjects.filter(function (wp) { return matchesSearch(wpSearchValues(wp)); });
    var activeNotifications = openNotifications();
    var onlineUnits = db.units.filter(function (unit) { return unitStatus(unit) !== "offline"; });
    var offlineUnits = db.units.filter(function (unit) { return unitStatus(unit) === "offline"; });
    function locationCountForUnits(units) {
      return new Set(units.map(function (unit) { return contextForUnit(unit).location.id; })).size;
    }
    var summaryCards =
      summaryCard("Total", "total", [
        { label: "Users", value: db.users.length },
        { label: "Locations", value: db.locations.length },
        { label: "Projects", value: db.projects.length },
        { label: "Units", value: db.units.length },
        { label: "Water projects", value: db.waterProjects.length },
        { label: "Customers", value: db.customers.length }
      ], null, true) +
      summaryCard("Notifications", "notifications", [
        { label: "Water projects with notifications", value: new Set(activeNotifications.filter(function (item) { return item.targetType === "waterProject"; }).map(function (item) { return item.targetId; })).size },
        { label: "Alarms", value: activeNotifications.filter(function (item) { return item.severity === "critical"; }).length },
        { label: "Warnings", value: activeNotifications.filter(function (item) { return item.severity === "warning"; }).length }
      ], "#/alarms", false) +
      summaryCard("Online", "online", [
        { label: "Units", value: onlineUnits.length },
        { label: "Locations", value: locationCountForUnits(onlineUnits) }
      ], "#/units", false) +
      summaryCard("Offline", "offline", [
        { label: "Units", value: offlineUnits.length },
        { label: "Locations", value: locationCountForUnits(offlineUnits) }
      ], "#/units", false);
    var waterProjectCards = visibleWps.slice(0, DASHBOARD_WATER_PROJECT_LIMIT).map(waterProjectOverviewCard).join("");
    var wpCountNote = searchQuery ? '<p class="muted">Showing up to ' + DASHBOARD_WATER_PROJECT_LIMIT + " of " + visibleWps.length + " matching water projects.</p>" : "";
    return pageHeader("Dashboard", "Monitor installation status, water quality and device activity.") +
      '<div class="overview-grid">' + summaryCards + "</div>" + wpCountNote +
      '<section class="section"><div class="section-title"><div><h2>Water projects</h2><span class="muted">Latest water values and operating status.</span></div><a href="#/waterprojects">Read more</a></div><div class="object-card-grid">' +
      (waterProjectCards || emptyState("No water projects match the search.")) + "</div></section>" +
      '<section class="section"><div class="section-title"><h2>Recent notifications</h2><a href="#/alarms">View all</a></div>' + renderNotifications(db.notifications.slice(0, 5), true) + "</section>";
  }

  function usersView() {
    var records = sourceRecordsFor("User");
    var users = db.users.filter(function (user) {
      return matchesSearch([user.id, user.name, user.companyName, user.email, user.telephone]);
    });
    return pageHeader("Users", "Manage account details, contact information and notification preferences.") +
      (users.length ? users.map(function (user) {
        return '<section class="section"><div class="detail-overview-grid"><article class="card"><div class="detail-card-head">' +
          objectIcon("user") + '<div><h2>' + esc(user.name) + '</h2><span class="muted">' + esc(user.companyName) +
          '</span></div></div><dl class="dl"><dt>User ID</dt><dd>' + esc(user.id) + '</dd><dt>E-mail</dt><dd>' + esc(user.email) +
          '</dd><dt>Telephone</dt><dd>' + esc(user.telephone) + '</dd><dt>Notifications</dt><dd>' + esc(user.notificationChannel) +
          '</dd></dl></article></div>' + renderSourceFieldCollection(records, user.id, {
            title: "User settings",
            description: "Account, address and communication preferences.",
            omitPathKeys: ["category"],
            openFirst: true
          }) + "</section>";
      }).join("") : emptyState("No users match the search."));
  }

  function locationsView() {
    var records = db.locations.filter(function (location) {
      var customer = customerForLocation(location);
      return matchesSearch([location.id, location.name, formatAddress(location), customer && customer.name]);
    });
    var rows = records.map(function (location) {
      var customer = customerForLocation(location);
      return '<tr class="risk-row" data-href="#/location/' + location.id + '">' +
        "<td>" + listItemIdentity("location", "#/location/" + location.id, location.name, location.id) + "</td>" +
        "<td>" + esc(customer && customer.name) + "</td><td>" + esc(formatAddress(location)) + "</td>" +
        "<td>" + projectsForLocation(location.id).length + "</td><td>" + unitsForLocation(location.id).length + "</td></tr>";
    });
    return pageHeader("Locations", "View installation sites, addresses and assigned projects.") +
      table(["Location", "Customer", "Address", "Projects", "Units"], rows);
  }

  function projectOverviewCard(project) {
    var units = unitsForProject(project.id);
    var waterProjects = waterProjectsForProject(project.id);
    var notifications = notificationsForUnits(units);
    return '<article class="object-overview-card card-clickable" data-href="#/project/' + project.id + '" role="link" tabindex="0">' +
      '<div class="object-card-head"><div class="object-card-identity">' + objectIcon("project") + '<div><div class="eyebrow">' +
      esc(project.code) + '</div><a href="#/project/' + project.id + '">' + esc(project.name) + '</a></div></div>' +
      (units.length ? statusChip(aggregateUnitStatus(units)) : '<span class="chip offline">No units</span>') + "</div>" +
      '<p class="object-card-description">' + esc(project.description) + '</p><div class="object-card-metrics">' +
      overviewMetric("Units", units.length) + overviewMetric("Water projects", waterProjects.length) +
      overviewMetric("Open notifications", activeNotificationCount(notifications)) +
      "</div></article>";
  }

  function locationDetailView(locationId) {
    var location = findById(db.locations, locationId);
    if (!location) return notFoundView("Location");
    var customer = customerForLocation(location);
    var projects = projectsForLocation(location.id);
    var units = unitsForLocation(location.id);
    var waterProjects = projects.reduce(function (all, project) { return all.concat(waterProjectsForProject(project.id)); }, []);
    var notifications = notificationsForUnits(units);
    return crumbs([{ label: "Locations", href: "#/locations" }, { label: location.name }]) +
      pageHeader(location.name, location.id + " · " + customer.name) +
      '<div class="detail-overview-grid section">' +
      detailSummaryCard("Location details", "location", [
        { label: "Address", value: formatAddress(location) },
        { label: "Customer", value: customer.name },
        { label: "Contact", value: customer.email }
      ], []) +
      detailSummaryCard("Installation overview", "system", [
        { label: "Controllers online", value: units.filter(function (unit) { return unitStatus(unit) === "online"; }).length + " of " + units.length },
        { label: "Open notifications", value: activeNotificationCount(notifications) }
      ], [
        { label: "Projects", value: projects.length },
        { label: "Units", value: units.length },
        { label: "Water projects", value: waterProjects.length }
      ]) + "</div>" +
      '<section class="section"><div class="section-title"><div><h2>Projects</h2><span class="muted">Short operational overview per project.</span></div><span class="section-count">' +
      projects.length + (projects.length === 1 ? " project" : " projects") + '</span></div><div class="object-card-grid">' +
      (projects.length ? projects.map(projectOverviewCard).join("") : emptyState("No projects assigned.")) + "</div></section>" +
      renderSourceFieldCollection(sourceRecordsFor("Location"), location.id, {
        title: "Location settings",
        description: "Site identity, address and notes.",
        omitPathKeys: ["category"],
        openFirst: true
      });
  }

  function projectsView() {
    var records = db.projects.filter(function (project) {
      var location = locationForProject(project);
      var customer = customerForLocation(location);
      return matchesSearch([project.id, project.name, project.code, project.description, location && location.name, customer && customer.name]);
    });
    var rows = records.map(function (project) {
      var location = locationForProject(project);
      return "<tr><td>" + listItemIdentity("project", "#/project/" + project.id, project.name, project.code) +
        '</td><td><a href="#/location/' + location.id + '">' + esc(location.name) + "</a></td><td>" +
        unitsForProject(project.id).length + "</td><td>" + waterProjectsForProject(project.id).length + "</td><td>" + esc(project.description) + "</td></tr>";
    });
    return pageHeader("Projects", "View project groups and their assigned units and water projects.") +
      table(["Project", "Location", "Units", "Water Projects", "Description"], rows);
  }

  function unitOverviewCard(unit) {
    var waterProjects = waterProjectsForUnit(unit.id);
    var notifications = notificationsForUnit(unit.id);
    return '<article class="object-overview-card card-clickable" data-href="#/unit/' + unit.id + '" role="link" tabindex="0">' +
      '<div class="object-card-head"><div class="object-card-identity">' + objectIcon("unit") + '<div><div class="eyebrow">' +
      esc(unit.code) + '</div><a href="#/unit/' + unit.id + '">' + esc(unit.name) + '</a></div></div>' + statusChip(unitStatus(unit)) + "</div>" +
      '<div class="object-card-facts"><span>Firmware <strong>' + esc(unit.firmwareVersion) + '</strong></span><span>Last seen <strong>' +
      esc(ageLabel(unit.communication.lastSeenAt)) + '</strong></span></div><div class="object-card-metrics">' +
      overviewMetric("Water projects", waterProjects.length) + overviewMetric("Equipment", componentsForUnit(unit.id).length) +
      overviewMetric("Open notifications", activeNotificationCount(notifications)) + "</div>" +
      (waterProjects.length ? '<div class="child-links"><span>Water projects</span><div>' + waterProjects.slice(0, 3).map(function (wp) {
        return '<a class="link-chip" href="#/waterproject/' + wp.id + '/info">' + esc(wp.name) + "</a>";
      }).join("") + "</div></div>" : "") +
      "</article>";
  }

  function projectDetailView(projectId) {
    var project = findById(db.projects, projectId);
    if (!project) return notFoundView("Project");
    var location = locationForProject(project);
    var customer = customerForLocation(location);
    var units = unitsForProject(project.id);
    var waterProjects = waterProjectsForProject(project.id);
    var notifications = notificationsForUnits(units);
    return crumbs([{ label: "Locations", href: "#/locations" }, { label: location.name, href: "#/location/" + location.id }, { label: project.name }]) +
      pageHeader(project.name, project.code + " · " + project.description) +
      '<div class="detail-overview-grid section">' +
      detailSummaryCard("Project details", "project", [
        { label: "Project code", value: project.code },
        { label: "Description", value: project.description },
        { label: "Location", value: location.name, href: "#/location/" + location.id },
        { label: "Customer", value: customer.name }
      ], []) +
      detailSummaryCard("Operational overview", "system", [
        { label: "Controllers online", value: units.filter(function (unit) { return unitStatus(unit) === "online"; }).length + " of " + units.length },
        { label: "Open notifications", value: activeNotificationCount(notifications) }
      ], [
        { label: "Units", value: units.length },
        { label: "Water projects", value: waterProjects.length },
        { label: "Equipment", value: units.reduce(function (count, unit) { return count + componentsForUnit(unit.id).length; }, 0) }
      ]) + "</div>" +
      '<section class="section"><div class="section-title"><div><h2>Units</h2><span class="muted">Controller status and assigned water projects.</span></div><span class="section-count">' +
      units.length + (units.length === 1 ? " unit" : " units") + '</span></div><div class="object-card-grid">' +
      (units.length ? units.map(unitOverviewCard).join("") : emptyState("No units assigned.")) + "</div></section>" +
      renderSourceFieldCollection(sourceRecordsFor("Project"), project.id, {
        title: "Project settings",
        description: "Project identity, type and description.",
        omitPathKeys: ["category"],
        openFirst: true
      });
  }

  function unitsView() {
    var records = db.units.filter(function (unit) { return matchesSearch(unitSearchValues(unit)); });
    var rows = records.map(function (unit) {
      var c = contextForUnit(unit);
      return "<tr><td>" + listItemIdentity("unit", "#/unit/" + unit.id, unit.name, unit.code) +
        "</td><td>" + statusChip(unitStatus(unit)) + '</td><td><a href="#/project/' + c.project.id + '">' + esc(c.project.name) +
        '</a></td><td><a href="#/location/' + c.location.id + '">' + esc(c.location.name) + "</a></td><td>" + waterProjectsForUnit(unit.id).length +
        "</td><td>" + componentsForUnit(unit.id).length + "</td><td>" + esc(ageLabel(unit.communication.lastSeenAt)) + "</td></tr>";
    });
    return pageHeader("Units", "Monitor controllers, connectivity and connected equipment.") +
      table(["Unit", "Status", "Project", "Location", "Water Projects", "Components", "Last seen"], rows);
  }

  function moduleOverviewCards(unit) {
    return findAll(db.unitModules, "unitId", unit.id).map(function (module) {
      var allocations = findAll(db.unitModuleAllocations, "moduleId", module.id);
      return '<article class="object-overview-card compact-object-card"><div class="object-card-head"><div class="object-card-identity">' +
        objectIcon("unit") + '<div><div class="eyebrow">Slot ' + esc(module.slot) + '</div><strong>' + esc(module.name) +
        '</strong></div></div><span class="chip ' + (module.active ? "success" : "offline") + '">' +
        (module.active ? "Active" : "Inactive") + '</span></div><div class="object-card-facts"><span>Model <strong>' + esc(module.model) +
        '</strong></span><span>Firmware <strong>' + esc(module.firmwareVersion) + '</strong></span></div><div class="object-card-metrics">' +
        overviewMetric("Allocated channels", allocations.length) + overviewMetric("Slot", module.slot) + "</div></article>";
    }).join("");
  }

  function equipmentOverviewCards(unit) {
    var groups = [];
    var positions = {};
    componentsForUnit(unit.id).forEach(function (component) {
      var category = component.category || "Other";
      if (positions[category] === undefined) {
        positions[category] = groups.length;
        groups.push({ category: category, components: [] });
      }
      groups[positions[category]].components.push(component);
    });
    return groups.map(function (group) {
      var allocated = group.components.filter(function (component) { return waterProjectsForComponent(component.id).length; }).length;
      var ports = group.components.filter(function (component) { return Boolean(portForComponent(component.id)); }).length;
      var icon = sectionIconName(group.category) ? sectionIcon(sectionIconName(group.category)) : objectIcon("equipment");
      return '<article class="object-overview-card compact-object-card"><div class="object-card-head"><div class="object-card-identity">' +
        icon + '<div><div class="eyebrow">Equipment</div><strong>' + esc(sectionDisplayTitle(group.category)) +
        '</strong></div></div></div><div class="object-card-metrics">' + overviewMetric("Items", group.components.length) +
        overviewMetric("Allocated", allocated) + overviewMetric("Ports", ports) + '</div><div class="compact-name-list">' +
        group.components.slice(0, 3).map(function (component) {
          return '<span><strong>' + esc(componentDisplayName(component)) + '</strong><small>' + esc(component.code) + "</small></span>";
        }).join("") + (group.components.length > 3 ? '<span class="muted">+' + (group.components.length - 3) + " more</span>" : "") +
        "</div></article>";
    }).join("");
  }

  function waterProjectOverviewCard(wp) {
    var telemetry = latestTelemetry(wp.id);
    var notifications = notificationsForWaterProject(wp.id);
    var openCount = activeNotificationCount(notifications);
    return '<article class="object-overview-card water-project-card card-clickable" data-href="#/waterproject/' + wp.id + '/info" role="link" tabindex="0">' +
      '<div class="object-card-head"><div class="object-card-identity">' + objectIcon("water") + '<div><div class="eyebrow">' + esc(wp.code) +
      '</div><a href="#/waterproject/' + wp.id + '/info">' + esc(wp.name) + '</a></div></div>' +
      (openCount ? '<span class="chip warn">' + openCount + " open</span>" : '<span class="chip success">No open notifications</span>') +
      '</div><div class="object-card-facts"><span>' + esc(wp.structure) + ' · <strong>' + esc(wp.volumeM3) +
      ' m³</strong></span><span>Updated <strong>' + esc(telemetry ? ageLabel(telemetry.measuredAt) : "Never") +
      '</strong></span></div><div class="object-card-metrics">' + overviewMetric("Components", componentsForWaterProject(wp.id).length) +
      overviewMetric("Controls", controlsForWaterProject(wp.id).length) + overviewMetric("Notifications", openCount) +
      '</div><div class="object-card-parameters">' + renderParamBadges(wp, 4) +
      "</div></article>";
  }

  function unitNotificationOverview(unit) {
    var records = notificationsForUnit(unit.id).sort(function (a, b) { return b.occurredAt.localeCompare(a.occurredAt); }).slice(0, 3);
    return '<article class="card activity-overview-card"><div class="detail-card-head">' + objectIcon("notification") +
      '<div><h2>Notifications</h2><span class="muted">' + activeNotificationCount(notificationsForUnit(unit.id)) +
      ' currently open</span></div></div>' + (records.length ? '<div class="compact-event-list">' + records.map(function (notification) {
        var href = notification.targetType === "waterProject" ? "#/waterproject/" + notification.targetId + "/notifications" : "#/unit/" + unit.id;
        return '<a class="compact-event" href="' + href + '"><span><strong>' + esc(notification.message) + '</strong><small>' +
          esc(ageLabel(notification.occurredAt)) + '</small></span>' + severityChip(notification.severity) + "</a>";
      }).join("") + "</div>" : emptyState("No notifications.")) + "</article>";
  }

  function unitActivityOverview(unit) {
    var records = db.commands.filter(function (command) { return command.unitId === unit.id; })
      .sort(function (a, b) { return b.requestedAt.localeCompare(a.requestedAt); }).slice(0, 3);
    return '<article class="card activity-overview-card"><div class="detail-card-head">' + objectIcon("activity") +
      '<div><h2>Recent activity</h2><span class="muted">Latest requests and service actions.</span></div></div>' +
      (records.length ? '<div class="compact-event-list">' + records.map(function (command) {
        var wp = command.waterProjectId ? findById(db.waterProjects, command.waterProjectId) : null;
        return '<div class="compact-event"><span><strong>' + esc(conciseObjectName(command.label)) + '</strong><small>' +
          esc(wp ? wp.name : "Unit") + " · " + esc(ageLabel(command.requestedAt)) + '</small></span><span class="chip">' +
          esc(command.status) + "</span></div>";
      }).join("") + "</div>" : emptyState("No device activity recorded.")) + "</article>";
  }

  function unitDetailView(unitId) {
    var unit = findById(db.units, unitId);
    if (!unit) return notFoundView("Unit");
    var c = contextForUnit(unit);
    var wps = waterProjectsForUnit(unit.id);
    var modules = findAll(db.unitModules, "unitId", unit.id);
    var components = componentsForUnit(unit.id);
    var update = db.firmwareUpdates.find(function (item) { return item.unitId === unit.id && item.state !== "completed"; });
    return crumbs([{ label: "Locations", href: "#/locations" }, { label: c.location.name, href: "#/location/" + c.location.id }, { label: c.project.name, href: "#/project/" + c.project.id }, { label: unit.name }]) +
      pageHeader(unit.name, unit.code + " · Firmware " + unit.firmwareVersion, '<button class="btn primary" data-action="firmware-update" data-id="' + unit.id + '">Schedule firmware update</button>') +
      '<div class="detail-summary-grid section">' +
      detailSummaryCard("System", "system", [
        { label: "Unit ID", value: unit.id }, { label: "MAC address", value: unit.macAddress },
        { label: "Installed", value: formatDate(unit.installedAt) }, { label: "Working hours", value: unit.workingHours.toLocaleString("en-BE") + " h" }
      ], []) +
      detailSummaryCard("General", "unit", [
        { label: "Language", value: unit.language.toUpperCase() }, { label: "Time zone", value: unit.timeZone },
        { label: "Auto lock", value: unit.display.autoLockEnabled ? "Enabled · " + unit.display.lockAfterMinutes + " min" : "Disabled" },
        { label: "Dim level", value: unit.display.dimPercent + "%" }
      ], []) +
      detailSummaryCard("Connectivity", "connectivity", [
        { label: "Status", html: statusChip(unitStatus(unit)) }, { label: "Channel", value: unit.communication.channel },
        { label: "Last seen", value: ageLabel(unit.communication.lastSeenAt) }
      ], []) +
      detailSummaryCard("Firmware", "firmware", [
        { label: "Current", value: unit.firmwareVersion }, { label: "Target", value: update ? update.toVersion : unit.firmwareVersion },
        { label: "State", value: update ? update.state : "Up to date" }, { label: "Progress", value: (update ? update.progressPercent : 100) + "%" }
      ], []) + "</div>" +
      '<section class="section"><div class="section-title"><div><h2>Water projects</h2><span class="muted">Latest parameters and operating status.</span></div><span class="section-count">' +
      wps.length + (wps.length === 1 ? " water project" : " water projects") + '</span></div><div class="object-card-grid">' +
      (wps.length ? wps.map(waterProjectOverviewCard).join("") : emptyState("No water projects assigned.")) + "</div></section>" +
      '<section class="section"><div class="section-title"><div><h2>Installed modules</h2><span class="muted">Slot, firmware and channel allocation.</span></div><span class="section-count">' +
      modules.length + (modules.length === 1 ? " module" : " modules") + '</span></div><div class="object-card-grid compact-card-grid">' +
      (modules.length ? moduleOverviewCards(unit) : emptyState("No modules installed.")) + "</div></section>" +
      '<section class="section"><div class="section-title"><div><h2>Equipment</h2><span class="muted">Grouped overview of connected components and ports.</span></div><span class="section-count">' +
      components.length + (components.length === 1 ? " component" : " components") + '</span></div><div class="object-card-grid compact-card-grid">' +
      (components.length ? equipmentOverviewCards(unit) : emptyState("No equipment connected.")) + "</div></section>" +
      '<div class="detail-overview-grid section">' + unitNotificationOverview(unit) + unitActivityOverview(unit) + "</div>" +
      renderSourceFieldCollection(sourceRecordsFor("Unit"), unit.id, {
        title: "Controller settings",
        description: "System, display, connectivity, modules and service settings.",
        omitPathKeys: ["category"],
        openFirst: true
      });
  }

  // WATER PROJECT VIEWS

  function waterProjectsView() {
    var records = db.waterProjects.filter(function (wp) { return matchesSearch(wpSearchValues(wp)); });
    var rows = records.map(function (wp) {
      var c = contextForWaterProject(wp);
      var telemetry = latestTelemetry(wp.id);
      return "<tr><td>" + listItemIdentity("water", "#/waterproject/" + wp.id + "/info", wp.name, wp.code) +
        "</td><td>" + esc(wp.structure) + "</td><td>" + esc(wp.volumeM3) + " m³</td><td>" +
        '<a href="#/unit/' + c.unit.id + '">' + esc(c.unit.name) + '</a></td><td><a href="#/project/' + c.project.id + '">' + esc(c.project.name) +
        '</a></td><td><a href="#/location/' + c.location.id + '">' + esc(c.location.name) +
        "</a></td><td>" + esc(sensorMode(wp.id)) + "</td><td>" + (telemetry ? esc(formatDateTime(telemetry.measuredAt)) : "—") +
        "</td><td>" + renderParamBadges(wp) + "</td></tr>";
    });
    return pageHeader("Water Projects", "Review pool configuration, live values and operating status.") +
      table(["Water Project", "Structure", "Volume", "Unit", "Project", "Location", "Sensing", "Last update", "Latest values"], rows);
  }

  function waterProjectTabs(wp, active) {
    var tabs = [
      { key: "info", label: "Info" },
      { key: "connections", label: "Connections" },
      { key: "protocols", label: "Protocols" },
      { key: "notifications", label: "Notifications" }
    ];
    return '<nav class="subtabs" aria-label="Water Project sections">' + tabs.map(function (tab) {
      return '<a class="' + (active === tab.key ? "active" : "") + '" href="#/waterproject/' + wp.id + "/" + tab.key + '">' + esc(tab.label) + "</a>";
    }).join("") + "</nav>";
  }

  function waterProjectShell(wp, active, content, actions) {
    var c = contextForWaterProject(wp);
    return crumbs([
        { label: "Locations", href: "#/locations" },
        { label: c.location.name, href: "#/location/" + c.location.id },
        { label: c.project.name, href: "#/project/" + c.project.id },
        { label: c.unit.name, href: "#/unit/" + c.unit.id },
        { label: wp.name }
      ]) +
      pageHeader(wp.name, wp.code + " · " + wp.structure + " · " + wp.volumeM3 + " m³", actions) +
      waterProjectTabs(wp, active) + content;
  }

  function controlTable(wp) {
    var telemetry = latestTelemetry(wp.id);
    var rows = controlsForWaterProject(wp.id).map(function (control) {
      var value = telemetry ? telemetry.values[control.parameter] : null;
      var state = classifyValue(control, value);
      var meta = PARAMS[control.parameter];
      return "<tr><td><strong>" + esc(meta.label) + "</strong></td><td>" + esc(formatValue(control.parameter, value)) +
        '</td><td><span class="chip ' + (state === "danger" ? "danger" : state === "warn" ? "warn" : state === "unknown" ? "offline" : "success") + '">' +
        esc(state) + "</span></td><td>" + esc(formatValue(control.parameter, control.setpoint)) + "</td><td>" +
        esc(formatValue(control.parameter, control.alarmLow)) + " – " + esc(formatValue(control.parameter, control.alarmHigh)) +
        "</td><td>" + esc(formatValue(control.parameter, control.correctLow)) + " – " + esc(formatValue(control.parameter, control.correctHigh)) + "</td></tr>";
    });
    return table(["Parameter", "Latest telemetry", "Evaluation", "Setpoint", "Alarm range", "Correction range"], rows, "compact");
  }

  function waterProjectInfoView(wp) {
    var c = contextForWaterProject(wp);
    var telemetry = latestTelemetry(wp.id);
    var content =
      '<div class="detail-grid"><article class="card"><h2>Water Project information</h2><dl class="dl">' +
      "<dt>Water Project ID</dt><dd>" + esc(wp.id) + "</dd><dt>Code</dt><dd>" + esc(wp.code) + "</dd><dt>Structure</dt><dd>" +
      esc(wp.structure) + "</dd><dt>Usage</dt><dd>" + esc(wp.usage) + "</dd><dt>Conditions</dt><dd>" + esc(wp.conditions) +
      "</dd><dt>Dimensions</dt><dd>" + esc(wp.lengthM) + " × " + esc(wp.widthM) + " × " + esc(wp.averageDepthM) +
      " m</dd><dt>Calculated volume</dt><dd>" + esc((wp.lengthM * wp.widthM * wp.averageDepthM).toFixed(1)) +
      " m³</dd><dt>Configured volume</dt><dd>" + esc(wp.volumeM3) + " m³</dd></dl></article>" +
      '<article class="card"><h2>Operational context</h2><dl class="dl"><dt>Owning unit</dt><dd><a href="#/unit/' + c.unit.id + '">' +
      esc(c.unit.name) + "</a></dd><dt>Allocated hardware</dt><dd>" + componentsForWaterProject(wp.id).length +
      "</dd><dt>Disinfection sensing</dt><dd>" + esc(sensorMode(wp.id)) + "</dd><dt>Telemetry source</dt><dd>" +
      esc(telemetry ? telemetry.sourceUnitId : "—") + "</dd><dt>Measured at</dt><dd>" + esc(telemetry ? formatDateTime(telemetry.measuredAt) : "—") +
      "</dd><dt>Freshness</dt><dd>" + esc(telemetry ? ageLabel(telemetry.measuredAt) : "No telemetry") +
      "</dd></dl></article></div>" +
      '<section class="section"><div class="section-title"><h2>Latest measured values and configured controls</h2></div>' +
      controlTable(wp) + "</section>" +
      renderSourceFieldCollection(sourceRecordsFor("Water Project", ["Info"]), wp.id, {
        title: "Water Project settings",
        description: "General information, structure and dimensions.",
        omitPathKeys: ["category"],
        openFirst: true
      });
    return waterProjectShell(wp, "info", content);
  }

  function componentConfigLines(component) {
    var values = Object.keys(component.configuration || {}).map(function (key) {
      var value = component.configuration[key];
      if (key.slice(-2) === "Id" && typeof value === "string") {
        var linked = findById(db.unitComponents, value);
        value = linked ? linked.name : value;
      }
      return "<dt>" + esc(key.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); })) +
        "</dt><dd>" + esc(typeof value === "boolean" ? (value ? "Yes" : "No") : value) + "</dd>";
    }).join("");
    return values || "<dt>Configuration</dt><dd>Standard</dd>";
  }

  function componentDevice(component, wp) {
    var port = portForComponent(component.id);
    var module = moduleForComponent(component.id);
    return '<article class="device"><div class="device-head"><div><strong>' + esc(componentDisplayName(component)) +
      '</strong><div class="muted">' + esc(component.code) + " · " + esc(component.id) + '</div></div><button class="btn secondary test-btn" ' +
      'data-action="component-test" data-id="' + component.id + '" data-wp="' + wp.id + '">Run test</button></div>' +
      '<dl class="dl"><dt>Module</dt><dd>' + esc(module ? "Slot " + module.slot + " · " + module.name : "Unassigned") +
      '</dd><dt>Physical port</dt><dd><span class="port-chip">' + esc(port ? port.label : "Unassigned") + "</span> " +
      esc(port ? port.signalType : "") + "</dd>" + componentConfigLines(component) + "</dl></article>";
  }

  function connectionComponentCategory(subcategory) {
    var map = {
      "Filtration and circulation": "Filtration",
      "Water stability": "Water stability",
      "Water Desinfection": "Disinfection",
      "Temperature, Heating & Cooling": "Temperature",
      "Level Control": "Level control"
    };
    return map[subcategory] || subcategory;
  }

  function waterProjectConnectionsView(wp) {
    var components = componentsForWaterProject(wp.id);
    var records = sourceRecordsWhere(function (record) {
      return record.object === "Water Project" && record.category === "Connections";
    });
    var sections = sourceGroups(records, "subcategory");
    var content = '<div class="accordion-stack">' + sections.map(function (section) {
      var sourceTitle = section.value || "General";
      var title = sectionDisplayTitle(sourceTitle);
      var componentCategory = connectionComponentCategory(sourceTitle);
      var items = components.filter(function (component) { return component.category === componentCategory; });
      var body = (items.length ? '<div class="device-list">' + items.map(function (component) {
        return componentDevice(component, wp);
      }).join("") + "</div>" : emptyState("No components assigned.")) + renderSourceFieldCollection(section.records, wp.id, {
        title: "Equipment settings",
        description: "Component setup, assignments, calibration and testing.",
        omitPathKeys: ["category", "subcategory"],
        embedded: true
      });
      var badges = [section.records.length + (section.records.length === 1 ? " setting" : " settings")];
      if (items.length) badges.unshift(items.length + (items.length === 1 ? " component" : " components"));
      return renderAccordionSection(
        title,
        "",
        badges,
        body,
        false,
        sectionIconName(sourceTitle)
      );
    }).join("") + "</div>";
    return waterProjectShell(wp, "connections", content);
  }

  function filtrationProtocolCard(wp) {
    var protocol = findAll(db.filtrationProtocols, "waterProjectId", wp.id)[0];
    if (!protocol) return emptyState("No filtration protocol is configured.");
    var pump = findById(db.unitComponents, protocol.filtrationPumpComponentId);
    var flow = findById(db.unitComponents, protocol.protectionFlowSensorComponentId);
    var pressure = findById(db.unitComponents, protocol.pressureSensorComponentId);
    var cycleRows = protocol.cycles.map(function (cycle) {
      return "<tr><td>" + cycle.sequence + "</td><td>" + esc(cycle.startLocalTime) + "</td><td>" + cycle.durationMinutes +
        " min</td><td>" + cycle.speedPercent + "%</td></tr>";
    });
    return '<article class="card protocol-card"><div class="device-head"><div><h2>Filtration</h2><div class="muted">Daily filtration schedule.</div></div>' +
      '<button class="btn secondary" data-action="protocol-command" data-command="manual_backwash" data-label="Manual backwash" data-wp="' + wp.id +
      '" data-target="' + protocol.id + '">Start manual backwash</button></div><dl class="dl"><dt>Pump</dt><dd>' +
      esc(componentDisplayName(pump)) + "</dd><dt>Flow protection</dt><dd>" + esc(componentDisplayName(flow)) + "</dd><dt>Pressure sensor</dt><dd>" +
      esc(componentDisplayName(pressure)) + "</dd><dt>Backwash</dt><dd>Every " + protocol.backwash.frequencyDays + " days · " +
      protocol.backwash.durationSeconds + " sec + " + protocol.backwash.rinseSeconds + " sec rinse</dd></dl>" +
      table(["Cycle", "Start (unit local time)", "Duration", "Pump speed"], cycleRows, "compact") + "</article>";
  }

  function measurementProtocolCard(wp, parameters, title) {
    var telemetry = latestTelemetry(wp.id);
    var controls = controlsForWaterProject(wp.id);
    if (parameters && parameters.length) {
      controls = controls.filter(function (control) { return parameters.indexOf(control.parameter) !== -1; });
    }
    if (!controls.length) return "";
    var includesDisinfection = controls.some(function (control) {
      return control.parameter === "freeChlorine" || control.parameter === "orp";
    });
    var badge = includesDisinfection ? sensorMode(wp.id) : controls.length + (controls.length === 1 ? " control" : " controls");
    return '<article class="card protocol-card"><div class="device-head"><div><h2>' + esc(title || "Measurement controls") +
      '</h2><div class="muted">Live sensor readings and control limits.</div></div>' +
      '<span class="chip success">' + esc(badge) + "</span></div>" +
      controls.map(function (control) {
        var sensor = findById(db.unitComponents, control.sensorComponentId);
        var value = telemetry ? telemetry.values[control.parameter] : null;
        return '<article class="device"><div class="device-head"><div><strong>' + esc(PARAMS[control.parameter].label) +
          '</strong><div class="muted">' + esc(componentDisplayName(sensor)) + '</div></div><button class="btn secondary test-btn" ' +
          'data-action="protocol-command" data-command="sensor_calibration" data-label="' + esc(PARAMS[control.parameter].label) +
          ' calibration" data-wp="' + wp.id + '" data-target="' + control.sensorComponentId + '">Calibrate</button></div>' +
          '<dl class="dl"><dt>Latest telemetry</dt><dd>' + esc(formatValue(control.parameter, value)) + " · " +
          esc(telemetry ? formatDateTime(telemetry.measuredAt) : "—") + "</dd><dt>Setpoint</dt><dd>" +
          esc(formatValue(control.parameter, control.setpoint)) + "</dd><dt>Correction range</dt><dd>" +
          esc(formatValue(control.parameter, control.correctLow)) + " – " + esc(formatValue(control.parameter, control.correctHigh)) +
          "</dd><dt>Alarm range</dt><dd>" + esc(formatValue(control.parameter, control.alarmLow)) + " – " +
          esc(formatValue(control.parameter, control.alarmHigh)) + "</dd></dl></article>";
      }).join("") + "</article>";
  }

  function dosingProtocolCard(wp, parameters, title) {
    var records = findAll(db.dosingProtocols, "waterProjectId", wp.id);
    if (parameters && parameters.length) {
      records = records.filter(function (protocol) { return parameters.indexOf(protocol.parameter) !== -1; });
    }
    if (!records.length) return "";
    var rows = records.map(function (protocol) {
      var dosing = findById(db.unitComponents, protocol.dosingComponentId);
      var sensor = findById(db.unitComponents, protocol.controllingSensorComponentId);
      var flow = findById(db.unitComponents, protocol.protectionFlowSensorComponentId);
      return "<tr><td>" + esc(protocol.parameter) + "</td><td>" + esc(componentDisplayName(dosing)) + "</td><td>" +
        esc(componentDisplayName(sensor)) + "</td><td>" + esc(componentDisplayName(flow)) + "</td><td>" +
        protocol.intervalOnSeconds + " sec on / " + protocol.intervalOffSeconds + " sec off</td></tr>";
    });
    var hasAlkaHardware = Boolean(controlFor(wp.id, "alkalinity"));
    var includesAlka = !parameters || parameters.indexOf("alkalinity") !== -1;
    var alkaBadge = includesAlka ? '<span class="chip ' + (hasAlkaHardware ? "success" : "offline") + '">ALKA ' +
      (hasAlkaHardware ? "configured" : "not installed") + "</span>" : "";
    var alkaNote = includesAlka ? '<p class="muted">' + (hasAlkaHardware ? "ALKA sensing and dosing are configured." :
      "ALKA equipment is not installed for this water project.") + "</p>" : "";
    return '<article class="card protocol-card"><div class="device-head"><div><h2>' + esc(title || "Dosing and disinfection") +
      '</h2><div class="muted">Configured dosing equipment and protection.</div></div>' + alkaBadge + "</div>" +
      table(["Parameter / technology", "Dosing component", "Controlling sensor", "Flow protection", "Interval"], rows, "compact") +
      alkaNote + "</article>";
  }

  function levelProtocolCard(wp) {
    var records = findAll(db.levelControlProtocols, "waterProjectId", wp.id);
    if (!records.length) return "";
    return '<article class="card protocol-card"><div class="device-head"><div><h2>Level control</h2><div class="muted">Water and chemical tank levels.</div></div>' +
      '<button class="btn secondary" data-action="protocol-command" data-command="level_refill" data-label="Level refill" data-wp="' +
      wp.id + '" data-target="' + records[0].id + '">Refill</button></div><div class="device-list">' +
      records.map(function (protocol) {
        var sensor = findById(db.unitComponents, protocol.levelSensorComponentId);
        var valve = protocol.fillValveComponentId ? findById(db.unitComponents, protocol.fillValveComponentId) : null;
        var protocolName = protocol.application === "water_project" ? "Water level" : protocol.name;
        var applicationLabel = protocol.application === "water_project" ? "Water project" : "Chemical tank";
        return '<article class="device"><div class="device-head"><strong>' + esc(protocolName) + '</strong><span class="chip">' +
          esc(applicationLabel) + '</span></div><dl class="dl"><dt>Sensor</dt><dd>' + esc(componentDisplayName(sensor)) +
          "</dd><dt>Fill valve</dt><dd>" + esc(valve ? componentDisplayName(valve) : "No automatic refill") + "</dd><dt>Target level</dt><dd>" +
          esc(protocol.targetPercent) + "%</dd><dt>Max fill</dt><dd>" + esc(protocol.maxFillMinutes ? protocol.maxFillMinutes + " min" : "—") +
          "</dd><dt>Max cycles / day</dt><dd>" + esc(protocol.maxCyclesPerDay || "—") + "</dd><dt>Mixer cycle</dt><dd>" +
          esc(protocol.mixerRunMinutes ? protocol.mixerRunMinutes + " min every " + protocol.repeatEveryMinutes + " min" : "—") +
          "</dd></dl></article>";
      }).join("") + "</div></article>";
  }

  function protocolOperationalContent(wp, subcategory) {
    if (subcategory === "Filtration and circulation") {
      return filtrationProtocolCard(wp) + measurementProtocolCard(wp, ["pressure", "flow"], "Pressure and flow controls");
    }
    if (subcategory === "Water stability") {
      return measurementProtocolCard(wp, ["ph", "alkalinity"], "Water stability controls") +
        dosingProtocolCard(wp, ["ph", "alkalinity"], "Water stability dosing");
    }
    if (subcategory === "Water disinfection") {
      return measurementProtocolCard(wp, ["freeChlorine", "orp"], "Disinfection sensing") +
        dosingProtocolCard(wp, ["freeChlorine", "electrolysis"], "Dosing and electrolysis");
    }
    if (subcategory === "Level Control") return levelProtocolCard(wp);
    if (subcategory === "Temperature") {
      return measurementProtocolCard(wp, ["temperature"], "Temperature control");
    }
    return "";
  }

  function waterProjectProtocolsView(wp) {
    var records = sourceRecordsWhere(function (record) {
      return record.object === "Water Project" && (record.category === "Protocol" || record.category === "Protocols");
    });
    var sections = sourceGroups(records, "subcategory");
    var content = '<div class="accordion-stack">' + sections.map(function (section) {
      var sourceTitle = section.value || "General";
      var title = sectionDisplayTitle(sourceTitle);
      var operational = protocolOperationalContent(wp, sourceTitle);
      var fieldContract = renderSourceFieldCollection(section.records, wp.id, {
        title: "Control settings",
        description: "Operation, setpoints, limits, dosing and maintenance.",
        omitPathKeys: ["category", "subcategory"],
        embedded: true
      });
      return renderAccordionSection(
        title,
        "",
        [section.records.length + (section.records.length === 1 ? " setting" : " settings")],
        (operational ? '<div class="protocol-stack">' + operational + "</div>" : emptyState("No protocol configured.")) + fieldContract,
        false,
        sectionIconName(sourceTitle)
      );
    }).join("") + renderAccordionSection(
      "Scheduling",
      "",
      [unitForWaterProject(wp).timeZone],
      '<dl class="dl schedule-details"><dt>Time zone</dt><dd>' + esc(unitForWaterProject(wp).timeZone) +
        '</dd><dt>Time basis</dt><dd>Local controller time</dd></dl>',
      false,
      "schedule"
    ) + "</div>";
    return waterProjectShell(wp, "protocols", content);
  }

  function waterProjectNotificationsView(wp) {
    var content = '<section class="section"><div class="section-title"><div><h2>Notification history</h2><span class="muted">Review status changes and acknowledgement details.</span></div></div>' +
      renderNotifications(notificationsForWaterProject(wp.id), false) + "</section>" +
      renderSourceFieldCollection(sourceRecordsFor("Water Project", ["Notification"]), wp.id, {
        title: "Notification settings",
        description: "Alarm and warning behavior.",
        omitPathKeys: ["category"],
        openFirst: true
      });
    return waterProjectShell(wp, "notifications", content);
  }

  function waterProjectDetailView(wpId, tab) {
    var wp = findById(db.waterProjects, wpId);
    if (!wp) return notFoundView("Water Project");
    if (tab === "connections") return waterProjectConnectionsView(wp);
    if (tab === "protocols") return waterProjectProtocolsView(wp);
    if (tab === "notifications") return waterProjectNotificationsView(wp);
    return waterProjectInfoView(wp);
  }

  function alarmsView() {
    return pageHeader("Notifications", "Review active and acknowledged installation events.") +
      renderNotifications(db.notifications, false);
  }

  function notFoundView(kind) {
    return pageHeader(kind + " not found", "The requested item could not be found.") +
      '<p><a class="btn primary" href="#/dashboard">Return to dashboard</a></p>';
  }

  function showToast(message) {
    var old = document.querySelector(".toast");
    if (old) old.remove();
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(function () { toast.classList.add("visible"); }, 10);
    window.setTimeout(function () {
      toast.classList.remove("visible");
      window.setTimeout(function () { toast.remove(); }, 250);
    }, 3200);
  }

  function currentRoute() {
    var hash = window.location.hash || "#/dashboard";
    return hash.replace(/^#\//, "").split("/").filter(Boolean);
  }

  function setActiveNavigation(route) {
    var key = route[0] || "dashboard";
    if (key === "location") key = "locations";
    if (key === "project") key = "projects";
    if (key === "unit") key = "units";
    if (key === "waterproject") key = "waterprojects";
    if (key === "alarms") key = "alarms";
    document.querySelectorAll("[data-route]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-route") === key);
    });
  }

  function render() {
    var route = currentRoute();
    setActiveNavigation(route);
    var html;
    if (route[0] === "users") html = usersView();
    else if (route[0] === "locations") html = locationsView();
    else if (route[0] === "location") html = locationDetailView(route[1]);
    else if (route[0] === "projects") html = projectsView();
    else if (route[0] === "project") html = projectDetailView(route[1]);
    else if (route[0] === "units") html = unitsView();
    else if (route[0] === "unit") html = unitDetailView(route[1]);
    else if (route[0] === "waterprojects") html = waterProjectsView();
    else if (route[0] === "waterproject") html = waterProjectDetailView(route[1], route[2] || "info");
    else if (route[0] === "alarms") html = alarmsView();
    else html = dashboardView();
    view.innerHTML = html;
    view.querySelectorAll("table.list tbody tr").forEach(function (row) {
      var primaryLink = row.querySelector('a[href^="#/"]');
      if (!primaryLink) return;
      if (!row.hasAttribute("data-href")) row.setAttribute("data-href", primaryLink.getAttribute("href"));
      row.classList.add("clickable-row");
      row.setAttribute("role", "link");
      row.setAttribute("tabindex", "0");
    });
    window.scrollTo(0, 0);
  }

  function saveSourceFieldControl(control, announce) {
    if (!control) return;
    var row = Number(control.getAttribute("data-row"));
    var contextId = control.getAttribute("data-context");
    var record = (CONFIGURATION_SCHEMA.records || []).find(function (item) { return item.excelRow === row; });
    if (!record) {
      if (announce) showToast("This setting could not be resolved.");
      return;
    }
    var value = control.value;
    if (control.type === "number" && value !== "") value = Number(value);
    db.configurationValues[sourceFieldValueKey(contextId, row)] = value;
    applySourceFieldToEntity(record, sourceContextEntity(record.object, contextId), value);
    saveDb();
    var field = control.closest(".source-field");
    if (field) {
      field.classList.add("saved");
      window.setTimeout(function () { field.classList.remove("saved"); }, 900);
    }
    if (announce) showToast(configurationFieldName(record) + " saved.");
  }

  view.addEventListener("input", function (event) {
    saveSourceFieldControl(event.target.closest("[data-source-field]"), false);
  });

  view.addEventListener("change", function (event) {
    saveSourceFieldControl(event.target.closest("[data-source-field]"), true);
  });

  view.addEventListener("click", function (event) {
    var actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      event.preventDefault();
      var action = actionElement.getAttribute("data-action");
      if (action === "reset-installation") {
        resetInstallationState();
      } else if (action === "toggle-ack") {
        toggleAcknowledgement(actionElement.getAttribute("data-id"));
      } else if (action === "firmware-update") {
        scheduleFirmwareUpdate(actionElement.getAttribute("data-id"));
      } else if (action === "component-test") {
        var component = findById(db.unitComponents, actionElement.getAttribute("data-id"));
        var wp = findById(db.waterProjects, actionElement.getAttribute("data-wp"));
        if (component && wp) {
          appendCommand({ unitId: component.unitId, waterProjectId: wp.id, targetType: "component", targetId: component.id, commandType: "component_test", label: "Test " + componentDisplayName(component) });
        }
      } else if (action === "protocol-command") {
        var waterProject = findById(db.waterProjects, actionElement.getAttribute("data-wp"));
        if (waterProject) {
          appendCommand({
            unitId: waterProject.unitId,
            waterProjectId: waterProject.id,
            targetType: "protocol",
            targetId: actionElement.getAttribute("data-target"),
            commandType: actionElement.getAttribute("data-command"),
            label: actionElement.getAttribute("data-label")
          });
        }
      }
      return;
    }
    var row = event.target.closest("[data-href]");
    if (row && !event.target.closest("a,button")) window.location.hash = row.getAttribute("data-href");
  });

  view.addEventListener("keydown", function (event) {
    var target = event.target.closest("[data-href]");
    if (!target || event.target.closest("a,button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.location.hash = target.getAttribute("data-href");
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      searchQuery = searchInput.value.trim().toLowerCase();
      render();
    });
  }

  var navToggle = document.getElementById("navToggle");
  var sidebar = document.getElementById("sidebar");
  var scrim = document.getElementById("scrim");
  var searchLabel = document.querySelector("label.search");
  var searchHome = searchLabel ? searchLabel.parentElement : null;
  var userButton = searchHome ? searchHome.querySelector(".icon-btn") : null;
  var menuSearchSlot = document.getElementById("menuSearchSlot");

  function closeSidebar() {
    document.body.classList.remove("side-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (scrim) scrim.hidden = true;
  }

  function placeSearch() {
    if (!searchLabel || !searchHome || !menuSearchSlot) return;
    if (window.matchMedia("(max-width:680px)").matches) {
      if (searchLabel.parentElement !== menuSearchSlot) menuSearchSlot.appendChild(searchLabel);
    } else if (searchLabel.parentElement !== searchHome) {
      searchHome.insertBefore(searchLabel, userButton || null);
    }
  }

  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var open = !document.body.classList.contains("side-open");
      document.body.classList.toggle("side-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      if (scrim) scrim.hidden = !open;
    });
  }
  if (scrim) scrim.addEventListener("click", closeSidebar);
  if (sidebar) sidebar.addEventListener("click", function (event) {
    if (event.target.closest("a")) closeSidebar();
  });

  window.addEventListener("hashchange", function () {
    closeSidebar();
    render();
  });
  window.addEventListener("resize", placeSearch);
  placeSearch();

  window.__IWATER__ = {
    schemaVersion: SCHEMA_VERSION,
    getDb: function () { return db; },
    validate: function () { return validateDb(db); },
    configurationCoverage: sourceCoverageReport,
    configurationFields: function () { return (CONFIGURATION_SCHEMA.records || []).slice(); },
    reset: resetInstallationState,
    selectors: {
      contextForUnit: contextForUnit,
      contextForWaterProject: contextForWaterProject,
      componentsForWaterProject: componentsForWaterProject,
      latestTelemetry: latestTelemetry,
      unitStatus: unitStatus
    }
  };

  render();
})();
