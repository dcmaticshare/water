/* ============================================================================
   DEMO DATA — hierarchy according to "boomstructuur volgens DCM.xlsx":
   User → Location (address) → Project (region within the location)
        → Unit (motherboard device) → Water Project (body of water)
   Each Water Project carries:
     - info        (General, Structure, Dimensions)
     - connections (physical connections on the motherboard)
     - protocols   (operational settings on the motherboard)
     - alarms      (Notifications: alarms & warnings)
   ==========================================================================*/
const Demo = (() => {
  const rand = (min,max) => Math.random()*(max-min)+min;
  const rint = (min,max) => Math.floor(rand(min,max));
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const pastDate = (daysAgoMin, daysAgoMax) => new Date(Date.now() - rint(daysAgoMin, daysAgoMax)*24*3600*1000).toISOString();
  const recent = hMax => new Date(Date.now() - Math.floor(Math.random()*hMax)*36e5).toISOString();
  const mac = () => 'A4:CF:' + Array.from({length:4},()=>rint(16,255).toString(16).toUpperCase().padStart(2,'0')).join(':');
  const swver = () => 'v' + rint(1,3) + '.' + rint(0,9) + '.' + rint(0,9);

  /* --- Value lists straight from the datamodel --- */
  const STRUCTURES = ['Pool','Pond','Hybride pool','Hybride pond','Lake','Tank','Cooling tower'];
  const TYPES_BY_STRUCTURE = {
    'Pool':          ['Skimmer','Overflow','Underflow','Infinity'],
    'Hybride pool':  ['Skimmer','Overflow','Underflow','Infinity'],
    'Pond':          ['Skimmer','Downflow','Upflow','Fish pond'],
    'Hybride pond':  ['Skimmer','Downflow','Upflow','Fish pond'],
    'Lake':          ['Natural'],
    'Tank':          ['Buffer tank','Process tank'],
    'Cooling tower': ['Induced draft','Forced draft']
  };
  const CONDITIONS = ['Indoor','Outdoor'];
  const MODULES = ['pH/T','pH/ALKA/T','pH/ALKA/FC/T','ALKA/T','ALKA/FC/T','FC/T','ORP/T','Stepper'];
  const PUMP_TYPES = ['Single','Frequency','Modbus'];
  const WP_NAMES = ['Main lagoon','Spa','Whirlpool','Kids pool','Thermal pool','Koi pond','Buffer tank','Lap pool','Plunge pool'];
  const PROJECT_TYPES = ['Wellness','Public swimming','Private','Hotel & resort','Aquapark','Industrial'];

  let pjid=1, uid=1, wpid=1, aid=1;

  const makeAlarm = (wpId, severity) => ({
    id: `AL-${(aid++).toString().padStart(3,'0')}`,
    wpId,
    severity,
    message: severity==='critical'
      ? pick(['No data','Sensor error','pH out of range','Level too low','Flow protection triggered'])
      : pick(['Low free chlorine','ALKA below correct low','Calibration needed','Refill dosage tank','Backwash overdue']),
    ts: recent(48),
    acknowledged: Math.random()>.55
  });

  /* --- Connections: the physical connections on the motherboard --- */
  const makeConnections = (wpName) => {
    let out=1, inp=1;
    const O = () => `OUT-${(out++).toString().padStart(2,'0')}`;
    const I = () => `IN-${(inp++).toString().padStart(2,'0')}`;
    const pumpType = pick(PUMP_TYPES);
    return {
      pumps: [{
        name:`Pump ${wpName}`, code:`P${rint(100,999)}`, fc: pick(['Filtration','Circulation']),
        type: pumpType, output: O(), testStatus:'Off'
      }],
      backwash: {
        name:'i-Backwash', code:`BW${rint(10,99)}`, principle: pick(['Automatic','Manual']),
        type: pick(['6-way valve manual','Rod Valve (automatic)']), outputValve: O(), connectFiltration:'Pump 1'
      },
      pressure: { name:'i-Pressure sensor', code:`PR${rint(10,99)}`, input: I(), connectFiltration:'Pump 1' },
      flow: { name:'i-Flow sensor', code:`FL${rint(10,99)}`, type: pick(['Flow','Flow rate']), input: I(), delay:`${rint(5,60)} s`, connectFiltration:'Pump 1' },
      air: Math.random()>.5 ? { name:'i-Air', code:`BL${rint(10,99)}`, output: O(), connectBackwash:'i-Backwash' } : null,
      phMeasurement: { name:'pH sensor', code:`PH${rint(10,99)}`, module:'', projectAllocation:wpName, testValue:+(rand(6.8,7.6)).toFixed(2) },
      phDosage: {
        name:'pH dosing pump', code:`PD${rint(10,99)}`, dosingType:'pH-', pumpType: pick(['On/Off','i-stepper']),
        output: O(), pumpFlow:`${(rand(20,90)).toFixed(1)} mL/min`, flowProtection: Math.random()>.3, sensorAllocation:'pH sensor'
      },
      alkaMeasurement: Math.random()>.35 ? {
        sensor:'ALKA module', module:'', outputPump: O(), outputCalValve: O(), outputMeasValve: O(), pumpFlow:`${(rand(10,40)).toFixed(1)} mL/min`
      } : null,
      alkaDosage: Math.random()>.35 ? {
        name:'ALKA dosing pump', code:`AD${rint(10,99)}`, dosingType:'ALKA+', pumpType: pick(['On/Off','i-stepper']),
        output: O(), pumpFlow:`${(rand(20,90)).toFixed(1)} mL/min`, flowProtection: Math.random()>.3, sensorAllocation:'ALKA module'
      } : null,
      wdSensor: { name:'Disinfection sensor', code:`WD${rint(10,99)}`, type: pick(['Free Chlorine (FC)','ORP']), module:'', projectAllocation:wpName },
      wdTech: {
        name:'Disinfection unit', code:`DT${rint(10,99)}`, type: pick(['Liquid chlorine dosing','Ionization']),
        output: O(), pumpFlow:`${(rand(20,60)).toFixed(1)} mL/min`, flowProtection:true, sensorAllocation:'Disinfection sensor'
      },
      levelSensors: [{
        name:'Level sensor', code:`LV${rint(10,99)}`, type: pick(['Float switch','Pressure switch']),
        application: pick(['Water Project','Tank','pH-','ALKA+','i-Chlorine']), input: I(),
        freshWaterCounter: Math.random()>.5, freshWaterValve: Math.random()>.5
      }],
      tempSensors: [{
        name:'Temperature sensor', code:`TP${rint(10,99)}`, application: pick(['Water','Air']),
        type: pick(['PT100','PT1000']), place: pick(['Technical room','Return line','Buffer tank']), input: I()
      }]
    };
  };

  /* --- Protocols: the operational settings on the motherboard --- */
  const makeProtocols = (measurements, pumpType) => {
    const speeds = pumpType==='Single' ? ['Single','Single','Single','Single'] : ['1','2','3','2'];
    return {
      filtration: {
        currentStatus: pick(['Filtration','Circulation','Backwash','OFF']),
        mode: pick(['Permanent','Timer','Intelligent']),
        pumpProtection: pick(['Off','Flow','Pressure','Flow & Pressure']),
        manualControl: Math.random()>.5,
        cycles: [
          { start:'06:00', stop:'10:00', speed:speeds[0] },
          { start:'12:00', stop:'15:00', speed:speeds[1] },
          { start:'18:00', stop:'22:00', speed:speeds[2] }
        ],
        turnover:`${(rand(3,8)).toFixed(1)} h`,
        backwash: {
          flowPrinciple: pick(['Pulsation','Full speed']),
          timePrinciple: pick(['Weekly scheme','Frequency (days)','Pressure controlled','Frequency (days) + Pressure controlled']),
          duration:`${rint(60,240)} sec`, time:'03:00', frequency:`${rint(3,10)} days`,
          scheme:{ Mon:true, Tue:false, Wed:true, Thu:false, Fri:true, Sat:false, Sun:false }
        }
      },
      phMeasurement: {
        current: measurements.pH, setpoint: 7.2, offset: 0.05, calibrationDate: pastDate(10,120),
        alarmLow: 6.8, correctLow: 7.0, correctHigh: 7.4, alarmHigh: 7.6,
        alarmSetting: pick(['Ignore','Notification','Stop + notification'])
      },
      phDosage: {
        status: Math.random()>.6 ? 'Dosing' : 'Off', dosingType:'pH-',
        intervalOn:`${rint(5,30)} sec`, intervalOff:`${rint(60,300)} sec`,
        lastMaintenance: pastDate(30,300), level: rint(8,100), cycli24h: rint(0,40)
      },
      alkaMeasurement: {
        current: measurements.alka, setpoint: 100, offset: 2, calibrationDate: pastDate(10,120),
        interval:'04:00', alarmLow: 60, correctLow: 80, correctHigh: 120, alarmHigh: 150,
        level: rint(8,100)
      },
      alkaDosage: {
        status: Math.random()>.7 ? 'Dosing' : 'Off', dosingType:'ALKA+',
        dose: pick(['High','Low']), lastMaintenance: pastDate(30,300), level: rint(8,100), cycli24h: rint(0,20)
      },
      disinfection: {
        sensorType: measurements.orp ? 'ORP' : 'Free Chlorine (FC)',
        current: measurements.orp || measurements.fc,
        unit: measurements.orp ? 'mV' : 'ppm',
        setpoint: measurements.orp ? 700 : 1.0,
        calibrationDate: pastDate(10,120),
        alarmLow: measurements.orp ? 550 : 0.3, correctLow: measurements.orp ? 650 : 0.5,
        correctHigh: measurements.orp ? 750 : 1.5, alarmHigh: measurements.orp ? 800 : 2.0,
        status: Math.random()>.6 ? 'Dosing' : 'Off',
        intervalOn:`${rint(5,30)} sec`, intervalOff:`${rint(60,600)} sec`,
        level: rint(8,100)
      },
      levelControl: {
        application:'Water Project',
        levelStatus: pick(['Too low','Low','Normal','High','Too high']),
        waterValve: pick(['Open','Closed']),
        waterCounter:`${rint(50,900)} L/day`,
        fillingTimeMax:`${rint(30,180)} min`,
        fillingCyclesMax:`${rint(2,10)} / day`
      }
    };
  };

  const makeWaterProject = () => {
    const id = `WP-${(wpid++).toString().padStart(3,'0')}`;
    const structure = pick(STRUCTURES.slice(0, 4)); // mostly pools & ponds in demo
    const useOrp = Math.random()>.7;
    const measurements = {
      pH: +(rand(6.7,8.1)).toFixed(2),
      alka: rint(40,180),                      // ppm
      fc: useOrp ? null : +(rand(0.1,2.2)).toFixed(2),   // ppm
      orp: useOrp ? rint(500,820) : null,      // mV
      temp: +(rand(21,31)).toFixed(1)          // °C
    };
    const connections = makeConnections('');
    const wp = {
      id,
      name: pick(WP_NAMES),
      structure,
      type: pick(TYPES_BY_STRUCTURE[structure]),
      conditions: pick(CONDITIONS),
      description:'',
      volume: +(rand(15,250)).toFixed(1),      // m³
      surface: rint(20,350),                   // m²
      lastView: recent(16),
      measurements,
      connections,
      protocols: makeProtocols(measurements, connections.pumps[0].type),
      alarms: []
    };
    connections.phMeasurement.projectAllocation = wp.name;
    connections.wdSensor.projectAllocation = wp.name;
    connections.pumps[0].name = `Pump ${wp.name}`;
    // ~35% of water projects get 1-2 notifications
    if(Math.random()>.65){
      const count = 1 + rint(0,1);
      for(let i=0;i<count;i++) wp.alarms.push(makeAlarm(id, Math.random()>.55 ? 'critical' : 'warning'));
    }
    return wp;
  };

  const makeUnit = (uix) => {
    const status = pick(['online','online','online','alert','offline']);
    const waterProjects = Array.from({length: 1 + (uix % 3)}, makeWaterProject);
    // motherboard modules, allocated to the water projects on this unit
    const modules = waterProjects.map((wp, i) => ({
      name: pick(MODULES.slice(0,7)), slot: i+1, allocation: `${wp.name} (${wp.id})`
    }));
    modules.push({ name:'Stepper', slot: modules.length+1, allocation:'—' });
    return {
      id:`U-${(uid++).toString().padStart(3,'0')}`,
      name:`Unit ${uix+1}`,
      status,
      lastSeen: recent(12),
      systemType: pick(['i-Control','i-Plug-in']),
      macId: mac(),
      softwareVersion: swver(),
      workingHours: rint(200, 45000),
      installationDate: pastDate(300, 800),
      language:'English', timezone:'Europe/Brussels (automatic)',
      values: pick(['Metric (SI)','US (Imperial)']),
      updateAvailable: Math.random()>.7,
      lastUpdate: pastDate(5, 200),
      display:{ autoLock:true, lockAfter:`${rint(1,15)} min`, dim:`${rint(30,100)} %` },
      comm:{ network: status!=='offline', bluetooth: Math.random()>.4, wifi:'iw-field', inactivityDays: status==='offline' ? rint(1,14) : 0 },
      modules,
      waterProjects
    };
  };

  const makeProject = (name, type, description, unitCount) => ({
    id:`PJ-${(pjid++).toString().padStart(3,'0')}`,
    name, type, description,
    units: Array.from({length:unitCount}, (_,i)=>makeUnit(i))
  });

  const locations = [
    { id:'loc-001', name:'Sportcentrum Noord', customer:'Gemeente Groningen',
      street:'Sportlaan', nr:'12', postalCode:'9723', town:'Groningen', country:'Netherlands', landCode:'NL',
      description:'Municipal sports centre with indoor pools',
      projects:[
        makeProject('Main building','Public swimming','Competition and recreation pools', 2),
        makeProject('Wellness wing','Wellness','Spa & thermal area', 1)
      ]},
    { id:'loc-002', name:'Villa Van Hoof', customer:'Van Hoof',
      street:'Zeeweg', nr:'7', postalCode:'2586', town:'Den Haag', country:'Netherlands', landCode:'NL',
      description:'Private residence',
      projects:[
        makeProject('Garden','Private','Outdoor pool and jacuzzi', 1)
      ]},
    { id:'loc-003', name:'AquaPark Utrecht', customer:'AquaPark BV',
      street:'Singel', nr:'88', postalCode:'3511', town:'Utrecht', country:'Netherlands', landCode:'NL',
      description:'City-centre water park',
      projects:[
        makeProject('Outdoor park','Aquapark','Outdoor lagoons and slides', 2),
        makeProject('Indoor arena','Aquapark','All-season indoor pools', 1)
      ]},
    { id:'loc-004', name:'Blue Gardens Hotel', customer:'Blue Gardens',
      street:'Korenmarkt', nr:'3', postalCode:'9000', town:'Gent', country:'Belgium', landCode:'BE',
      description:'Boutique hotel with spa',
      projects:[
        makeProject('Spa & wellness','Hotel & resort','Spas and plunge pools', 1)
      ]},
    { id:'loc-005', name:'Aqua Resort', customer:'Aqua Resort NV',
      street:'Meir', nr:'50', postalCode:'2000', town:'Antwerpen', country:'Belgium', landCode:'BE',
      description:'Resort with multiple lagoons',
      projects:[
        makeProject('Lagoon zone','Hotel & resort','Three connected lagoons', 2),
        makeProject('Hotel rooftop','Hotel & resort','Rooftop infinity pool', 1)
      ]},
    { id:'loc-006', name:'Domaine Les Agnels', customer:'Les Agnels',
      street:'Markt', nr:'1', postalCode:'8000', town:'Brugge', country:'Belgium', landCode:'BE',
      description:'Historic estate with ponds',
      projects:[
        makeProject('Estate','Private','Swimming pond and koi pond', 1)
      ]}
  ];

  return { locations };
})();

/* =============== STATE =============== */
const storeKey = 'iw-installer-mock-v3';
const State = {
  load(){ try{ const saved = JSON.parse(localStorage.getItem(storeKey) || 'null'); if(saved) return saved }catch{}; return { locations: Demo.locations }; },
  save(d){ localStorage.setItem(storeKey, JSON.stringify(d)) }
};
let db = State.load();

/* =============== UI STATE =============== */
const UI = { dashFilter: 'total' };

/* =============== UTIL =============== */
const fmt = {
  date(iso){ const d = new Date(iso); return d.toLocaleDateString('en-GB'); },
  datetime(iso){ const d = new Date(iso); return d.toLocaleString('en-GB'); },
  rel(iso){
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.round(ms/1000), m = Math.round(s/60), h = Math.round(m/60), d = Math.round(h/24);
    if (s < 60) return `${s} s ago`;
    if (m < 60) return `${m} min ago`;
    if (h < 24) return `${h} h ago`;
    return `${d} d ago`;
  },
  bool(v){ return v ? 'Yes' : 'No' },
  onoff(v){ return v ? 'On' : 'Off' },
  statusChip(s){
    const map = {
      online:'<span class="chip online">● Online</span>',
      alert:'<span class="chip warn">● Alert</span>',
      offline:'<span class="chip offline">● Offline</span>'
    }; return map[s] || s;
  },
  sevChip(s){
    const t = s==='critical'?'Alarm':(s==='warning'?'Warning':'Info');
    const c = s==='critical'?'danger':(s==='warning'?'warn':'');
    return `<span class="chip ${c}">${t}</span>`;
  }
};

const Icons = {
  total:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>`,
  online:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M16 9l-5.2 6L8 12.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  alert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 9v4m0 4h.01M2 21h20L12 3 2 21z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  offline:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

/* =============== DERIVED VIEWS OF DATA =============== */
const Data = {
  allLocations(){ return db.locations },
  allProjects(){
    return db.locations.flatMap(L => L.projects.map(PJ => ({
      ...PJ, locationId:L.id, locationName:L.name, customer:L.customer, town:L.town, country:L.country
    })));
  },
  allUnits(){
    return db.locations.flatMap(L => L.projects.flatMap(PJ => PJ.units.map(U => ({
      ...U, projectId:PJ.id, projectName:PJ.name,
      locationId:L.id, locationName:L.name, customer:L.customer, town:L.town
    }))));
  },
  allWaterProjects(){
    return db.locations.flatMap(L => L.projects.flatMap(PJ => PJ.units.flatMap(U => U.waterProjects.map(WP => ({
      ...WP, unitId:U.id, unitName:U.name, unitStatus:U.status,
      projectId:PJ.id, projectName:PJ.name,
      locationId:L.id, locationName:L.name, customer:L.customer, town:L.town
    })))));
  },
  allAlarms(){
    return db.locations.flatMap(L =>
      L.projects.flatMap(PJ =>
        PJ.units.flatMap(U =>
          U.waterProjects.flatMap(WP =>
            (WP.alarms||[]).map(A => ({
              ...A,
              locationId:L.id, locationName:L.name, customer:L.customer,
              projectId:PJ.id, projectName:PJ.name,
              unitId:U.id, unitName:U.name,
              wpId:WP.id, wpName:WP.name
            }))
          )
        )
      )
    );
  }
};

/* =============== HELPERS =============== */
function paramTiles(m){
  const tiles = [];
  const t = (lbl, val, level) => level==='ok' ? '' : `<div class="param ${level}"><div class="lbl">${lbl}</div><div class="val">${val}</div></div>`;
  const phLevel = (m.pH<7.0||m.pH>7.8) ? 'danger' : ((m.pH<7.2||m.pH>7.6) ? 'warn' : 'ok');
  tiles.push(t('pH', m.pH.toFixed(2), phLevel));
  const alkaLevel = (m.alka<60||m.alka>150) ? 'danger' : ((m.alka<80||m.alka>120) ? 'warn' : 'ok');
  tiles.push(t('ALKA', `${m.alka} ppm`, alkaLevel));
  if(m.fc != null){
    const fcLevel = (m.fc<0.3||m.fc>2.0) ? 'danger' : ((m.fc<0.5||m.fc>1.5) ? 'warn' : 'ok');
    tiles.push(t('FC', `${m.fc.toFixed(2)} ppm`, fcLevel));
  }
  if(m.orp != null){
    const orpLevel = (m.orp<550||m.orp>800) ? 'danger' : ((m.orp<650||m.orp>750) ? 'warn' : 'ok');
    tiles.push(t('ORP', `${m.orp} mV`, orpLevel));
  }
  return tiles.filter(Boolean);
}
function countByStatus(units){ const tally = {online:0, alert:0, offline:0}; units.forEach(u=>tally[u.status]++); return tally; }
function alarmChips(alarms){
  const crit = (alarms||[]).filter(a=>a.severity==='critical').length;
  const warn = (alarms||[]).filter(a=>a.severity==='warning').length;
  return `${crit ? `<span class="chip danger">${Icons.bell} ${crit}</span>` : ''}
          ${warn ? `<span class="chip warn">${Icons.bell} ${warn}</span>` : ''}
          ${(!crit && !warn) ? '<span class="muted">0</span>' : ''}`;
}
function wpAlarmsOf(list){ return list.flatMap(wp => wp.alarms||[]); }
function linkChip(href, label, title=''){
  return `<a class="link-chip" href="${href}" title="${title}">${label}</a>`;
}
function chipList(chips){
  return chips.length ? `<div class="chip-links">${chips.join('')}</div>` : '<span class="muted">-</span>';
}
function crumbs(parts){
  return `<nav class="crumbs">${parts.map(p => p.href ? `<a href="${p.href}">${p.label}</a>` : `<span>${p.label}</span>`).join('<span class="sep">›</span>')}</nav>`;
}
function kv(pairs){
  return `<div class="dl" style="margin-top:10px">${pairs.map(([k,v])=>`<dt>${k}</dt><dd>${v ?? '-'}</dd>`).join('')}</div>`;
}
function bar(pct, danger=20){
  const cls = pct <= danger ? 'danger' : (pct <= 40 ? 'warn' : '');
  return `<div class="bar ${cls}" title="${pct}%"><i style="width:${pct}%"></i></div><span class="muted" style="font-size:.85rem">${pct}%</span>`;
}
function rangeRow(p){
  // alarm low / correct low / correct high / alarm high
  return `<div class="range-row">
    <span class="chip danger">AL ${p.alarmLow}</span>
    <span class="chip warn">CL ${p.correctLow}</span>
    <span class="chip success">Setpoint ${p.setpoint}</span>
    <span class="chip warn">CH ${p.correctHigh}</span>
    <span class="chip danger">AH ${p.alarmHigh}</span>
  </div>`;
}
function testBtn(label='Test'){
  return `<button class="btn secondary test-btn" onclick="Views._toggleTest(this)">${label}: Off</button>`;
}

/* =============== ROUTER =============== */
const Router = {
  routes:{},
  go(hash){ location.hash = hash },
  on(path, render){ Router.routes[path] = render },
  start(){
    const render = () => {
      const path = location.hash.replace('#','') || '/dashboard';
      const [base, param, sub] = path.split('/').filter(Boolean);

      // Map detail pages to their parent nav item
      const navKey = base==='unit' ? 'units'
                    : base==='wp' ? 'waterprojects'
                    : base==='project' ? 'projects'
                    : base==='location' ? 'locations'
                    : base;

      document.querySelectorAll('.tabs a, .side-links a').forEach(a=>{
        a.classList.toggle('active', a.getAttribute('href') === `#/${navKey}`);
      });

      const el = document.getElementById('view');
      if(base==='unit' && param){ Views.unitDetail(el, decodeURIComponent(param)); return; }
      if(base==='wp' && param){ Views.wpDetail(el, decodeURIComponent(param), sub || 'info'); return; }
      if(base==='project' && param){ Views.projectDetail(el, decodeURIComponent(param)); return; }
      if(base==='location' && param){ Views.locationDetail(el, decodeURIComponent(param)); return; }
      (Router.routes[`/${base}`] || Router.routes['/dashboard'])(el);
    };
    window.addEventListener('hashchange', render);
    render();
  }
};

/* =============== VIEWS =============== */
const Views = {
  /* ----- DASHBOARD ----- */
  dashboard(el){
    const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const locations = Data.allLocations();
    const projects = Data.allProjects();
    const units = Data.allUnits();
    const wpsAll = Data.allWaterProjects();
    const alarms = Data.allAlarms();

    const customers = new Set(locations.map(l=>l.customer)).size;
    const wpsWithNotifs = new Set(alarms.map(a=>a.wpId)).size;
    const crit = alarms.filter(a=>a.severity==='critical').length;
    const warn = alarms.filter(a=>a.severity==='warning').length;

    const onlineUnits = units.filter(u=>u.status==='online').length;
    const onlineLocations = new Set(units.filter(u=>u.status==='online').map(u=>u.locationId)).size;
    const offlineUnits = units.filter(u=>u.status==='offline').length;
    const offlineLocations = new Set(units.filter(u=>u.status==='offline').map(u=>u.locationId)).size;

    // Filter water projects according to active KPI card
    let rows = wpsAll;
    if(UI.dashFilter==='risky')       rows = wpsAll.filter(p => (p.alarms?.length||0) > 0);
    else if(UI.dashFilter==='online') rows = wpsAll.filter(p => p.unitStatus === 'online');
    else if(UI.dashFilter==='offline')rows = wpsAll.filter(p => p.unitStatus === 'offline');
    const qMatch = (p) => (`${p.name} ${p.locationName} ${p.projectName} ${p.customer} ${p.unitName}`).toLowerCase().includes(q);
    rows = rows.filter(qMatch);

    const isActive = f => UI.dashFilter===f ? 'active' : '';
    const filterName = ({ total:'All', risky:'Notifications', online:'Online', offline:'Offline' })[UI.dashFilter] || UI.dashFilter;

    el.innerHTML = `
      <div class="toolbar column">
        <h1 data-accent>Dashboard</h1>
        <div class="help">Click a card to filter the <strong>water projects</strong> list. Click any row to open its detail.</div>
      </div>

      <section class="kpis">
        <div class="kpi clickable ${isActive('total')}" data-filter="total" tabindex="0" role="button" aria-pressed="${UI.dashFilter==='total'}">
          <h3><span class="icon-badge" style="color:#0b4bab">${Icons.total}</span> Total</h3>
          <div class="kpi-row"><span>Locations</span><span class="kpi-num">${locations.length}</span></div>
          <div class="kpi-row"><span>Projects</span><span class="kpi-num">${projects.length}</span></div>
          <div class="kpi-row"><span>Units</span><span class="kpi-num">${units.length}</span></div>
          <div class="kpi-row"><span>Water projects</span><span class="kpi-num">${wpsAll.length}</span></div>
          <div class="kpi-row"><span>Customers</span><span class="kpi-num">${customers}</span></div>
        </div>

        <div class="kpi clickable ${isActive('risky')}" data-filter="risky" tabindex="0" role="button" aria-pressed="${UI.dashFilter==='risky'}">
          <h3><span class="icon-badge" style="color:#8a2222">${Icons.alert}</span> Notifications</h3>
          <div class="kpi-row"><span>Water projects with notifications</span><span class="kpi-num">${wpsWithNotifs}</span></div>
          <div class="kpi-row"><span>Alarms</span><span class="kpi-num">${crit}</span></div>
          <div class="kpi-row"><span>Warnings</span><span class="kpi-num">${warn}</span></div>
        </div>

        <div class="kpi clickable ${isActive('online')}" data-filter="online" tabindex="0" role="button" aria-pressed="${UI.dashFilter==='online'}">
          <h3><span class="icon-badge" style="color:var(--success)">${Icons.online}</span> Online</h3>
          <div class="kpi-row"><span>Units</span><span class="kpi-num">${onlineUnits}</span></div>
          <div class="kpi-row"><span>Locations</span><span class="kpi-num">${onlineLocations}</span></div>
        </div>

        <div class="kpi clickable ${isActive('offline')}" data-filter="offline" tabindex="0" role="button" aria-pressed="${UI.dashFilter==='offline'}">
          <h3><span class="icon-badge" style="color:var(--danger)">${Icons.offline}</span> Offline</h3>
          <div class="kpi-row"><span>Units</span><span class="kpi-num">${offlineUnits}</span></div>
          <div class="kpi-row"><span>Locations</span><span class="kpi-num">${offlineLocations}</span></div>
        </div>
      </section>

      <section class="section">
        <div class="toolbar" style="margin-bottom:10px">
          <h2 data-accent style="--blob-w:.9em; --blob-h:1.3em">Water Projects</h2>
          <div class="help">Filter: <strong>${filterName}</strong> · Results: <strong>${rows.length}</strong> water projects</div>
        </div>
        ${Views.wpList(rows, { offline: UI.dashFilter==='offline' })}
      </section>
    `;

    Views._bindKpiClicks();
    Views._bindRowClicks();
  },

  /* ----- LOCATIONS OVERVIEW ----- */
  locations(el){
    const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const rows = Data.allLocations()
      .filter(L => (`${L.name} ${L.customer} ${L.street} ${L.town} ${L.country}`).toLowerCase().includes(q))
      .map(L=>{
        const units = L.projects.flatMap(pj=>pj.units);
        const s = countByStatus(units);
        const projectChips = L.projects.map(pj => linkChip(`#/project/${pj.id}`, pj.name, pj.id));
        const unitChips = units.map(u => linkChip(`#/unit/${u.id}`, u.id, u.name));
        const wpChips = units.flatMap(u=>u.waterProjects).map(wp => linkChip(`#/wp/${wp.id}`, wp.name, wp.id));
        return `
          <tr class="risk-row" data-location="${L.id}" tabindex="0">
            <td><strong>${L.name}</strong><div class="muted">${L.street} ${L.nr}, ${L.postalCode} ${L.town} (${L.landCode})</div></td>
            <td>${L.customer}</td>
            <td>${chipList(projectChips)}</td>
            <td>${chipList(unitChips)}</td>
            <td>${chipList(wpChips)}</td>
            <td>
              <span class="chip online">Online ${s.online}</span>
              <span class="chip warn">Alert ${s.alert}</span>
              <span class="chip offline">Offline ${s.offline}</span>
            </td>
          </tr>
        `;
      }).join('');

    el.innerHTML = `
      <div class="toolbar">
        <h1 data-accent>Locations</h1>
        <div class="help">A location is an address. Click a row to open the location detail.</div>
      </div>
      <div class="table-scroll">
        <table class="list">
          <thead><tr><th>Location</th><th>Customer</th><th>Projects</th><th>Units</th><th>Water projects</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- PROJECTS OVERVIEW ----- */
  projects(el){
    const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const rows = Data.allProjects()
      .filter(PJ => (`${PJ.name} ${PJ.type} ${PJ.locationName} ${PJ.customer}`).toLowerCase().includes(q))
      .map(PJ=>{
        const notifs = wpAlarmsOf(PJ.units.flatMap(u=>u.waterProjects));
        const unitChips = PJ.units.map(u => linkChip(`#/unit/${u.id}`, u.id, u.name));
        const wpChips = PJ.units.flatMap(u=>u.waterProjects).map(wp => linkChip(`#/wp/${wp.id}`, wp.name, wp.id));
        return `
          <tr class="risk-row" data-project="${PJ.id}" tabindex="0">
            <td><strong>${PJ.name}</strong><div class="muted">${PJ.description || ''}</div></td>
            <td><a href="#/location/${PJ.locationId}">${PJ.locationName}</a><div class="muted">${PJ.customer}</div></td>
            <td>${PJ.type}</td>
            <td>${chipList(unitChips)}</td>
            <td>${chipList(wpChips)}</td>
            <td>${alarmChips(notifs)}</td>
          </tr>
        `;
      }).join('');

    el.innerHTML = `
      <div class="toolbar">
        <h1 data-accent>Projects</h1>
        <div class="help">A project is a region within a location (e.g. multiple lagoons or spas). Click a row to open the project detail.</div>
      </div>
      <div class="table-scroll">
        <table class="list">
          <thead><tr><th>Project</th><th>Location</th><th>Type</th><th>Units</th><th>Water projects</th><th>Notifications</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- UNITS OVERVIEW ----- */
  units(el){
    const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const units = Data.allUnits()
      .filter(u => (`${u.id} ${u.name} ${u.projectName} ${u.locationName} ${u.customer} ${u.systemType}`).toLowerCase().includes(q));

    const rows = units.map(u => {
      const notifs = wpAlarmsOf(u.waterProjects||[]);
      const wpChips = (u.waterProjects||[]).map(wp => linkChip(`#/wp/${wp.id}`, wp.name, wp.id));
      return `
        <tr class="risk-row" data-unit="${u.id}">
          <td><strong>${u.id}</strong><div class="muted">${u.name} · ${u.systemType}</div></td>
          <td><a href="#/project/${u.projectId}">${u.projectName}</a></td>
          <td><a href="#/location/${u.locationId}">${u.locationName}</a></td>
          <td>${fmt.statusChip(u.status)}</td>
          <td>${chipList(wpChips)}</td>
          <td>${alarmChips(notifs)}</td>
          <td>${fmt.rel(u.lastSeen)}</td>
        </tr>
      `;
    }).join('');

    el.innerHTML = `
      <div class="toolbar">
        <h1 data-accent>Units</h1>
        <div class="help">A unit is the motherboard device connecting pumps, covers, lights and measurements. All units in the system.</div>
      </div>
      <div class="table-scroll">
        <table class="list">
          <thead><tr><th>Unit</th><th>Project</th><th>Location</th><th>Status</th><th>Water projects</th><th>Notifications</th><th>Last seen</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- WATER PROJECTS OVERVIEW ----- */
  waterprojects(el){
    const q = (document.getElementById('globalSearch')?.value || '').trim().toLowerCase();
    const rows = Data.allWaterProjects()
      .filter(p => (`${p.name} ${p.structure} ${p.locationName} ${p.projectName} ${p.customer} ${p.unitName}`).toLowerCase().includes(q));

    el.innerHTML = `
      <div class="toolbar">
        <h1 data-accent>Water Projects</h1>
        <div class="help">All water projects (pools, ponds, tanks, …) with parameters and notifications.</div>
      </div>
      ${Views.wpList(rows)}
    `;
    Views._bindRowClicks();
  },

  /* ----- NOTIFICATIONS OVERVIEW ----- */
  alarms(el){
    const all = Data.allAlarms().sort((a,b)=> new Date(b.ts)-new Date(a.ts));
    el.innerHTML = `
      <div class="toolbar">
        <h1 data-accent>Notifications</h1>
        <div class="help">Alarms and warnings across all water projects.</div>
      </div>
      ${Views.tableAlarms(all,true)}
    `;
  },

  /* ----- LOCATION DETAIL ----- */
  locationDetail(el, locId){
    const L = db.locations.find(x => x.id === locId);
    if(!L){ el.innerHTML = '<p>Location not found.</p>'; return; }

    const projects = L.projects.map(PJ => {
      const wps = PJ.units.reduce((n,u)=>n+u.waterProjects.length,0);
      const notifs = wpAlarmsOf(PJ.units.flatMap(u=>u.waterProjects));
      return `
        <tr class="risk-row" data-project="${PJ.id}">
          <td><strong>${PJ.name}</strong><div class="muted">${PJ.description || ''}</div></td>
          <td>${PJ.type}</td>
          <td>${PJ.units.length}</td>
          <td>${wps}</td>
          <td>${alarmChips(notifs)}</td>
        </tr>
      `;
    }).join('');

    const locAlarms = Data.allAlarms().filter(a => a.locationId === L.id).sort((a,b)=> new Date(b.ts)-new Date(a.ts));

    el.innerHTML = `
      ${crumbs([{label:'Locations', href:'#/locations'},{label:L.name}])}
      <div class="toolbar">
        <button class="btn ghost" onclick="history.back()">&larr; Back</button>
        <h1 data-accent>${L.name} <span class="muted">(${L.customer})</span></h1>
        <div style="flex:1"></div>
      </div>

      <div class="detail">
        <div class="photo"><img alt="Photo of the location" src="https://picsum.photos/seed/${encodeURIComponent(L.id)}/900/600" /></div>
        <div class="card">
          <div class="title">General address</div>
          ${kv([
            ['Name (Location/company)', L.name],
            ['Street + nr', `${L.street} ${L.nr}`],
            ['Postal code', L.postalCode],
            ['Town', L.town],
            ['Country', L.country],
            ['Land code', L.landCode],
            ['Description', L.description || '-']
          ])}
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="title">Projects on this location</div>
          <div class="table-scroll" style="margin-top:10px">
            <table class="list">
              <thead><tr><th>Project</th><th>Type</th><th>Units</th><th>Water projects</th><th>Notifications</th></tr></thead>
              <tbody>${projects}</tbody>
            </table>
          </div>
          <div class="help" style="margin-top:8px">A project is a region within this location. Click a row to open it.</div>
        </div>

        <div class="card">
          <div class="title">Notifications (all water projects on this location)</div>
          ${locAlarms.length ? Views.tableAlarms(locAlarms) : '<p class="muted">No notifications on this location.</p>'}
        </div>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- PROJECT DETAIL ----- */
  projectDetail(el, pjId){
    const L = db.locations.find(loc => loc.projects.some(pj=>pj.id===pjId));
    if(!L){ el.innerHTML = '<p>Project not found.</p>'; return; }
    const PJ = L.projects.find(pj=>pj.id===pjId);

    const units = PJ.units.map(u => {
      const notifs = wpAlarmsOf(u.waterProjects||[]);
      return `
        <tr class="risk-row" data-unit="${u.id}">
          <td><strong>${u.id}</strong><div class="muted">${u.name} · ${u.systemType}</div></td>
          <td>${fmt.statusChip(u.status)}</td>
          <td>${u.waterProjects.length}</td>
          <td>${alarmChips(notifs)}</td>
          <td>${fmt.rel(u.lastSeen)}</td>
        </tr>
      `;
    }).join('');

    const pjAlarms = Data.allAlarms().filter(a => a.projectId === PJ.id).sort((a,b)=> new Date(b.ts)-new Date(a.ts));

    el.innerHTML = `
      ${crumbs([{label:'Locations', href:'#/locations'},{label:L.name, href:`#/location/${L.id}`},{label:PJ.name}])}
      <div class="toolbar">
        <button class="btn ghost" onclick="history.back()">&larr; Back</button>
        <h1 data-accent>${PJ.name} <span class="muted">(${PJ.id})</span></h1>
        <div style="flex:1"></div>
      </div>

      <div class="detail">
        <div class="photo"><img alt="Photo of the project" src="https://picsum.photos/seed/${encodeURIComponent(PJ.id)}/900/600" /></div>
        <div class="card">
          <div class="title">Project details</div>
          ${kv([
            ['Name project', PJ.name],
            ['Project type', PJ.type],
            ['Description', PJ.description || '-'],
            ['Location', `<a href="#/location/${L.id}">${L.name}</a>`],
            ['Customer', L.customer]
          ])}
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="title">Units in this project</div>
          <div class="table-scroll" style="margin-top:10px">
            <table class="list">
              <thead><tr><th>Unit</th><th>Status</th><th>Water projects</th><th>Notifications</th><th>Last seen</th></tr></thead>
              <tbody>${units}</tbody>
            </table>
          </div>
          <div class="help" style="margin-top:8px">Click a unit row to open the unit detail.</div>
        </div>

        <div class="card">
          <div class="title">Notifications (all water projects in this project)</div>
          ${pjAlarms.length ? Views.tableAlarms(pjAlarms) : '<p class="muted">No notifications in this project.</p>'}
        </div>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- UNIT DETAIL ----- */
  unitDetail(el, unitId){
    let L, PJ, U;
    outer: for(const loc of db.locations){
      for(const pj of loc.projects){
        const u = pj.units.find(x=>x.id===unitId);
        if(u){ L=loc; PJ=pj; U=u; break outer; }
      }
    }
    if(!U){ el.innerHTML = '<p>Unit not found.</p>'; return; }

    const wps = U.waterProjects.map(p => {
      const tiles = paramTiles(p.measurements);
      return `
        <tr class="risk-row" data-wp="${p.id}">
          <td><strong>${p.name}</strong><div class="muted">${p.structure} · ${p.type}</div></td>
          <td><div class="param-badges">${tiles.length? tiles.join('') : '<span class="muted">OK</span>'}</div></td>
          <td>${alarmChips(p.alarms)}</td>
          <td>${fmt.rel(p.lastView)}</td>
        </tr>
      `;
    }).join('');

    const modules = U.modules.map(m => `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${m.slot}</td>
        <td>${m.allocation}</td>
      </tr>
    `).join('');

    const unitAlarms = (U.waterProjects||[]).flatMap(p => (p.alarms||[]).map(a => ({
      ...a,
      wpId:p.id, wpName:p.name,
      unitId:U.id, unitName:U.name,
      projectId:PJ.id, projectName:PJ.name,
      locationId:L.id, locationName:L.name, customer:L.customer
    }))).sort((a,b)=> new Date(b.ts)-new Date(a.ts));

    el.innerHTML = `
      ${crumbs([
        {label:'Locations', href:'#/locations'},
        {label:L.name, href:`#/location/${L.id}`},
        {label:PJ.name, href:`#/project/${PJ.id}`},
        {label:U.name}
      ])}
      <div class="toolbar">
        <button class="btn ghost" onclick="history.back()">&larr; Back</button>
        <h1 data-accent>${U.name} <span class="muted">(${U.id})</span></h1>
        <div style="flex:1"></div>
        <div>${fmt.statusChip(U.status)}</div>
      </div>

      <div class="detail">
        <div class="photo"><img alt="Photo of the unit" src="https://picsum.photos/seed/${encodeURIComponent(U.id)}/900/600" /></div>
        <div class="card">
          <div class="title">System settings — Unit</div>
          ${kv([
            ['Name', U.name],
            ['Unit-MAC-ID', U.macId],
            ['System type', U.systemType],
            ['Software version', U.softwareVersion],
            ['Working hours unit', `${U.workingHours} h`],
            ['Installation date', fmt.date(U.installationDate)],
            ['Project', `<a href="#/project/${PJ.id}">${PJ.name}</a>`],
            ['Location', `<a href="#/location/${L.id}">${L.name}</a>`],
            ['Customer', L.customer],
            ['Last seen', fmt.rel(U.lastSeen)],
            ['Status', fmt.statusChip(U.status)]
          ])}
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="title">General</div>
          ${kv([
            ['Language', U.language],
            ['Timezone', U.timezone],
            ['Values', U.values],
            ['Automatic lock', fmt.onoff(U.display.autoLock)],
            ['Lock after', U.display.lockAfter],
            ['Dim', U.display.dim]
          ])}
        </div>
        <div class="card">
          <div class="title">Update</div>
          ${kv([
            ['Unit updates available', fmt.bool(U.updateAvailable)],
            ['Date last update', fmt.date(U.lastUpdate)]
          ])}
          ${U.updateAvailable ? '<div style="margin-top:10px"><button class="btn">Update unit</button></div>' : ''}
        </div>
        <div class="card">
          <div class="title">Communication</div>
          ${kv([
            ['Network', fmt.onoff(U.comm.network)],
            ['WiFi', U.comm.wifi],
            ['Bluetooth', fmt.onoff(U.comm.bluetooth)],
            ['Inactivity', U.comm.inactivityDays ? `${U.comm.inactivityDays} days` : '-']
          ])}
        </div>
      </div>

      <div class="cards" style="margin-top:18px">
        <div class="card">
          <div class="title">Modules on the motherboard</div>
          <div class="table-scroll" style="margin-top:10px">
            <table class="list">
              <thead><tr><th>Module name</th><th>Location on motherboard</th><th>Allocation to Water Project</th></tr></thead>
              <tbody>${modules}</tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="title">Water projects on this unit</div>
          <div class="table-scroll" style="margin-top:10px">
            <table class="list">
              <thead><tr><th>Water project</th><th>Parameters</th><th>Notifications</th><th>Latest view</th></tr></thead>
              <tbody>${wps}</tbody>
            </table>
          </div>
          <div class="help" style="margin-top:8px">Tip: click a row to open the water project detail.</div>
        </div>
      </div>

      <div class="cards" style="margin-top:18px">
        <div class="card">
          <div class="title">Notifications (all water projects on this unit)</div>
          ${unitAlarms.length ? Views.tableAlarms(unitAlarms) : '<p class="muted">No notifications for this unit\'s water projects.</p>'}
        </div>
      </div>
    `;
    Views._bindRowClicks();
  },

  /* ----- WATER PROJECT DETAIL (tabbed: Info | Connections | Protocols | Notifications) ----- */
  wpDetail(el, wpId, tab='info'){
    const P = Data.allWaterProjects().find(p => p.id === wpId);
    if(!P){ el.innerHTML = '<p>Water project not found.</p>'; return; }

    const tabs = [
      ['info','Info'],
      ['connections','Connections'],
      ['protocols','Protocols'],
      ['notifications','Notifications']
    ];
    const subnav = `<nav class="subtabs">${tabs.map(([k,lbl]) =>
      `<a href="#/wp/${encodeURIComponent(P.id)}/${k}" class="${tab===k?'active':''}">${lbl}${k==='notifications' && P.alarms.length ? ` <span class="chip danger" style="padding:2px 8px">${P.alarms.length}</span>` : ''}</a>`
    ).join('')}</nav>`;

    const body = tab==='connections' ? Views._wpConnections(P)
               : tab==='protocols'   ? Views._wpProtocols(P)
               : tab==='notifications' ? Views._wpNotifications(P)
               : Views._wpInfo(P);

    el.innerHTML = `
      ${crumbs([
        {label:'Locations', href:'#/locations'},
        {label:P.locationName, href:`#/location/${P.locationId}`},
        {label:P.projectName, href:`#/project/${P.projectId}`},
        {label:P.unitName, href:`#/unit/${P.unitId}`},
        {label:P.name}
      ])}
      <div class="toolbar">
        <button class="btn ghost" onclick="history.back()">&larr; Back</button>
        <h1 data-accent>${P.name} <span class="muted">(${P.id})</span></h1>
        <div style="flex:1"></div>
        <div>${fmt.statusChip(P.unitStatus)}</div>
      </div>
      ${subnav}
      ${body}
    `;
    Views._bindRowClicks();
  },

  /* --- WP tab: Info --- */
  _wpInfo(P){
    const m = P.measurements;
    const tiles = paramTiles(m);
    return `
      <div class="detail">
        <div class="photo"><img alt="Photo of the water project" src="https://picsum.photos/seed/${encodeURIComponent(P.id)}/900/600" /></div>
        <div class="card">
          <div class="title">Info — General & Structure</div>
          ${kv([
            ['Name water project', P.name],
            ['Project structure', P.structure],
            ['Project type', P.type],
            ['Project conditions', P.conditions],
            ['Description', P.description || '-'],
            ['Volume', `${P.volume} m³`],
            ['Surface', `${P.surface} m²`],
            ['Parent unit', `<a href="#/unit/${encodeURIComponent(P.unitId)}" class="btn secondary" style="text-decoration:none">Open ${P.unitName} (${P.unitId})</a>`],
            ['Project', `<a href="#/project/${P.projectId}">${P.projectName}</a>`],
            ['Location', `<a href="#/location/${P.locationId}">${P.locationName}</a>`],
            ['Customer', P.customer],
            ['Latest view', fmt.rel(P.lastView)]
          ])}
        </div>
      </div>

      <div class="cards">
        <div class="card">
          <div class="title">Live measurements</div>
          ${kv([
            ['pH', m.pH.toFixed(2)],
            ['Alkalinity', `${m.alka} ppm`],
            ...(m.fc!=null ? [['Free chlorine', `${m.fc.toFixed(2)} ppm`]] : []),
            ...(m.orp!=null ? [['ORP', `${m.orp} mV`]] : []),
            ['Temperature', `${m.temp} °C`]
          ])}
          <div class="param-badges" style="margin-top:12px">
            ${tiles.length ? tiles.join('') : '<span class="muted">All parameters within range.</span>'}
          </div>
        </div>
        <div class="card">
          <div class="title">Shortcuts</div>
          <p class="muted">Connections are the physical connections on the motherboard; protocols are the operational settings afterwards.</p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px">
            <a class="btn secondary" style="text-decoration:none" href="#/wp/${encodeURIComponent(P.id)}/connections">Open Connections</a>
            <a class="btn secondary" style="text-decoration:none" href="#/wp/${encodeURIComponent(P.id)}/protocols">Open Protocols</a>
          </div>
        </div>
      </div>
    `;
  },

  /* --- WP tab: Connections (physical connections on the motherboard) --- */
  _wpConnections(P){
    const C = P.connections;
    const dev = (title, pairs, test) => `
      <div class="device">
        <div class="device-head"><strong>${title}</strong>${test ? testBtn() : ''}</div>
        ${kv(pairs)}
      </div>`;

    const pumps = C.pumps.map(p => dev(`${p.name} (${p.code})`, [
      ['Filtration or circulation', p.fc],
      ['Type', p.type],
      ['Output Nr°', p.output],
      ['Project allocated', 'Yes']
    ], true)).join('');

    return `
      <div class="help" style="margin-bottom:12px">All physical connections on the motherboard of unit <a href="#/unit/${encodeURIComponent(P.unitId)}">${P.unitName}</a> for this water project.</div>
      <div class="cards conn-grid">

        <div class="card">
          <div class="title">Filtration and circulation</div>
          ${pumps}
          ${dev(`${C.backwash.name} (${C.backwash.code})`, [
            ['Connect with filtration', C.backwash.connectFiltration],
            ['Principle', C.backwash.principle],
            ['Type', C.backwash.type],
            ['Output Nr° valve', C.backwash.outputValve]
          ], true)}
          ${dev(`${C.pressure.name} (${C.pressure.code})`, [
            ['Connect with filtration', C.pressure.connectFiltration],
            ['Input Nr°', C.pressure.input]
          ])}
          ${dev(`${C.flow.name} (${C.flow.code})`, [
            ['Type of flow sensor', C.flow.type],
            ['Connect with filtration', C.flow.connectFiltration],
            ['Input Nr°', C.flow.input],
            ['Delay time', C.flow.delay]
          ])}
          ${C.air ? dev(`${C.air.name} (${C.air.code})`, [
            ['Output Nr°', C.air.output],
            ['Connect with backwash', C.air.connectBackwash]
          ], true) : ''}
        </div>

        <div class="card">
          <div class="title">Water stability</div>
          ${dev(`pH measurement (${C.phMeasurement.code})`, [
            ['Module number', 'Module 1'],
            ['Project allocation', C.phMeasurement.projectAllocation],
            ['Test value pH', C.phMeasurement.testValue]
          ], true)}
          ${dev(`pH dosage (${C.phDosage.code})`, [
            ['Dosing type', C.phDosage.dosingType],
            ['Pump type', C.phDosage.pumpType],
            ['Output Nr°', C.phDosage.output],
            ['Pump flow', C.phDosage.pumpFlow],
            ['Flow protection', fmt.bool(C.phDosage.flowProtection)],
            ['pH sensor allocation', C.phDosage.sensorAllocation]
          ], true)}
          ${C.alkaMeasurement ? dev('ALKA measurement', [
            ['Select sensor', C.alkaMeasurement.sensor],
            ['Output measurement pump', C.alkaMeasurement.outputPump],
            ['Output calibration valve', C.alkaMeasurement.outputCalValve],
            ['Output measurement valve', C.alkaMeasurement.outputMeasValve],
            ['Pump flow', C.alkaMeasurement.pumpFlow]
          ], true) : ''}
          ${C.alkaDosage ? dev(`ALKA dosage (${C.alkaDosage.code})`, [
            ['Dosing type', C.alkaDosage.dosingType],
            ['Pump type', C.alkaDosage.pumpType],
            ['Output Nr°', C.alkaDosage.output],
            ['Pump flow', C.alkaDosage.pumpFlow],
            ['Flow protection', fmt.bool(C.alkaDosage.flowProtection)],
            ['ALKA sensor allocation', C.alkaDosage.sensorAllocation]
          ], true) : ''}
        </div>

        <div class="card">
          <div class="title">Water disinfection</div>
          ${dev(`${C.wdSensor.name} (${C.wdSensor.code})`, [
            ['Type of sensor', C.wdSensor.type],
            ['Module number', 'Module 1'],
            ['Project allocation', C.wdSensor.projectAllocation]
          ], true)}
          ${dev(`${C.wdTech.name} (${C.wdTech.code})`, [
            ['Type technology', C.wdTech.type],
            ['Output Nr°', C.wdTech.output],
            ['Pump flow', C.wdTech.pumpFlow],
            ['Flow protection', fmt.bool(C.wdTech.flowProtection)],
            ['Allocate WD sensor', C.wdTech.sensorAllocation]
          ], true)}
        </div>

        <div class="card">
          <div class="title">Level control</div>
          ${C.levelSensors.map(s => dev(`${s.name} (${s.code})`, [
            ['Sensor type', s.type],
            ['Application', s.application],
            ['Input Nr°', s.input],
            ['Fresh water counter', fmt.bool(s.freshWaterCounter)],
            ['Fresh water valve', fmt.bool(s.freshWaterValve)]
          ], true)).join('')}
        </div>

        <div class="card">
          <div class="title">Temperature, heating &amp; cooling</div>
          ${C.tempSensors.map(s => dev(`${s.name} (${s.code})`, [
            ['Application', s.application],
            ['Type sensor', s.type],
            ['Place sensor', s.place],
            ['Input Nr°', s.input]
          ], true)).join('')}
        </div>
      </div>
    `;
  },

  /* --- WP tab: Protocols (operational settings) --- */
  _wpProtocols(P){
    const pr = P.protocols;
    const f = pr.filtration;
    const schemeChips = Object.entries(f.backwash.scheme)
      .map(([d,on]) => `<span class="chip ${on?'success':'offline'}">${d}</span>`).join(' ');
    const cycles = f.cycles.map((c,i)=>`
      <tr><td>Cycle ${i+1}</td><td>${c.start}</td><td>${c.stop}</td><td>${c.speed}</td></tr>
    `).join('');

    return `
      <div class="help" style="margin-bottom:12px">Operational settings on the motherboard for this water project.</div>
      <div class="cards conn-grid">

        <div class="card">
          <div class="title">Filtration and circulation</div>
          ${kv([
            ['Current status', `<span class="chip">${f.currentStatus}</span>`],
            ['Mode', f.mode],
            ['Pump protection', f.pumpProtection],
            ['Manual control pump', fmt.onoff(f.manualControl)],
            ['Turnover', f.turnover]
          ])}
          <div class="device">
            <div class="device-head"><strong>Cycles (${f.mode})</strong></div>
            <div class="table-scroll" style="margin-top:8px">
              <table class="list compact">
                <thead><tr><th>Cycle</th><th>Start</th><th>Stop</th><th>Speed</th></tr></thead>
                <tbody>${cycles}</tbody>
              </table>
            </div>
          </div>
          <div class="device">
            <div class="device-head"><strong>Backwash</strong>${testBtn('Manual backwash')}</div>
            ${kv([
              ['Flow principle', f.backwash.flowPrinciple],
              ['Time principle', f.backwash.timePrinciple],
              ['Duration', f.backwash.duration],
              ['Backwash time', f.backwash.time],
              ['Frequency', f.backwash.frequency]
            ])}
            <div style="margin-top:8px">${schemeChips}</div>
          </div>
        </div>

        <div class="card">
          <div class="title">Water stability — pH</div>
          <div class="device">
            <div class="device-head"><strong>pH measurement</strong></div>
            ${kv([
              ['Current pH value', `<strong>${pr.phMeasurement.current.toFixed(2)}</strong>`],
              ['pH setpoint', pr.phMeasurement.setpoint.toFixed(2)],
              ['pH offset', pr.phMeasurement.offset],
              ['Calibration date', fmt.date(pr.phMeasurement.calibrationDate)],
              ['Alarm setting', pr.phMeasurement.alarmSetting]
            ])}
            ${rangeRow(pr.phMeasurement)}
          </div>
          <div class="device">
            <div class="device-head"><strong>pH dosage (${pr.phDosage.dosingType})</strong><span class="chip ${pr.phDosage.status==='Dosing'?'success':'offline'}">${pr.phDosage.status}</span></div>
            ${kv([
              ['Interval ON', pr.phDosage.intervalOn],
              ['Interval OFF', pr.phDosage.intervalOff],
              ['Cycli last 24 h', pr.phDosage.cycli24h],
              ['Last maintenance', fmt.date(pr.phDosage.lastMaintenance)]
            ])}
            <div class="level-row"><span>Level ${pr.phDosage.dosingType} dosage</span>${bar(pr.phDosage.level)}</div>
            <div style="margin-top:8px"><button class="btn secondary">Refill…</button></div>
          </div>
        </div>

        <div class="card">
          <div class="title">Water stability — Alkalinity</div>
          <div class="device">
            <div class="device-head"><strong>ALKA measurement</strong></div>
            ${kv([
              ['Current ALKA value', `<strong>${pr.alkaMeasurement.current} ppm</strong>`],
              ['ALKA setpoint', `${pr.alkaMeasurement.setpoint} ppm`],
              ['ALKA offset', `${pr.alkaMeasurement.offset} ppm`],
              ['ALKA interval', pr.alkaMeasurement.interval],
              ['Calibration date', fmt.date(pr.alkaMeasurement.calibrationDate)]
            ])}
            ${rangeRow(pr.alkaMeasurement)}
            <div class="level-row"><span>Level ALKA solution</span>${bar(pr.alkaMeasurement.level)}</div>
          </div>
          <div class="device">
            <div class="device-head"><strong>ALKA dosage (${pr.alkaDosage.dosingType})</strong><span class="chip ${pr.alkaDosage.status==='Dosing'?'success':'offline'}">${pr.alkaDosage.status}</span></div>
            ${kv([
              ['High or low dose', pr.alkaDosage.dose],
              ['Cycli last 24 h', pr.alkaDosage.cycli24h],
              ['Last maintenance', fmt.date(pr.alkaDosage.lastMaintenance)]
            ])}
            <div class="level-row"><span>Level ALKA dosage</span>${bar(pr.alkaDosage.level)}</div>
            <div style="margin-top:8px"><button class="btn secondary">Refill…</button></div>
          </div>
        </div>

        <div class="card">
          <div class="title">Water disinfection</div>
          <div class="device">
            <div class="device-head"><strong>Sensor (${pr.disinfection.sensorType})</strong></div>
            ${kv([
              ['Current value', `<strong>${pr.disinfection.current} ${pr.disinfection.unit}</strong>`],
              ['Setpoint', `${pr.disinfection.setpoint} ${pr.disinfection.unit}`],
              ['Calibration date', fmt.date(pr.disinfection.calibrationDate)]
            ])}
            ${rangeRow(pr.disinfection)}
          </div>
          <div class="device">
            <div class="device-head"><strong>Disinfection technology</strong><span class="chip ${pr.disinfection.status==='Dosing'?'success':'offline'}">${pr.disinfection.status}</span></div>
            ${kv([
              ['Interval ON', pr.disinfection.intervalOn],
              ['Interval OFF', pr.disinfection.intervalOff]
            ])}
            <div class="level-row"><span>Level dosage</span>${bar(pr.disinfection.level)}</div>
            <div style="margin-top:8px"><button class="btn secondary">Refill…</button></div>
          </div>
        </div>

        <div class="card">
          <div class="title">Level control</div>
          ${kv([
            ['Application', pr.levelControl.application],
            ['Level status', `<span class="chip ${pr.levelControl.levelStatus==='Normal'?'success':'warn'}">${pr.levelControl.levelStatus}</span>`],
            ['Status water valve', pr.levelControl.waterValve],
            ['Water counter', pr.levelControl.waterCounter],
            ['Filling time MAX', pr.levelControl.fillingTimeMax],
            ['Filling cycle MAX / day', pr.levelControl.fillingCyclesMax]
          ])}
        </div>
      </div>
    `;
  },

  /* --- WP tab: Notifications --- */
  _wpNotifications(P){
    const notifs = (P.alarms||[]).map(a => ({
      ...a,
      wpId:P.id, wpName:P.name,
      unitId:P.unitId, unitName:P.unitName,
      projectId:P.projectId, projectName:P.projectName,
      locationId:P.locationId, locationName:P.locationName, customer:P.customer
    })).sort((a,b)=> new Date(b.ts)-new Date(a.ts));
    return `
      <div class="cards">
        <div class="card">
          <div class="title">Notifications — alarms &amp; warnings</div>
          ${notifs.length ? Views.tableAlarms(notifs, true) : '<p class="muted">No notifications for this water project.</p>'}
        </div>
      </div>
    `;
  },

  /* ----- PARTIALS ----- */
  wpList(rows, opts = {}){
    const showOfflineCol = !!opts.offline;
    if(!rows.length) return '<p class="muted">No water projects found.</p>';
    const trs = rows.map(p=>{
      const tiles = paramTiles(p.measurements);
      const unit = Data.allUnits().find(u=>u.id===p.unitId);
      return `
        <tr class="risk-row" data-wp="${p.id}">
          <td style="text-decoration:underline"><strong>${p.name}</strong><div class="muted" style="text-decoration:none">${p.structure} · ${p.type}</div></td>
          <td><a href="#/location/${p.locationId}">${p.locationName}</a><div class="muted">${p.customer}</div></td>
          <td><a href="#/project/${p.projectId}">${p.projectName}</a></td>
          <td><a href="#/unit/${p.unitId}">${p.unitName}</a></td>
          <td>${alarmChips(p.alarms)}</td>
          <td><div class="param-badges">${tiles.length ? tiles.join('') : '<span class="muted">OK</span>'}</div></td>
          ${showOfflineCol ? `<td>${p?.unitStatus==='offline' ? (unit?.lastSeen ? fmt.datetime(unit.lastSeen) : '-') : '-'}</td>` : ''}
          <td>${fmt.rel(p.lastView)}</td>
        </tr>
      `;
    }).join('');
    return `
      <div class="table-scroll">
        <table class="list risk-list" aria-label="Water projects overview">
          <thead>
            <tr>
              <th>Water project</th>
              <th>Location</th>
              <th>Project</th>
              <th>Unit</th>
              <th>Notifications</th>
              <th>Parameters</th>
              ${showOfflineCol ? '<th>Date offline</th>' : ''}
              <th>Latest view</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    `;
  },

  tableAlarms(list, actionable=false){
    if(!list.length) return '<p class="muted">No notifications.</p>';
    const rows = list
      .sort((a,b)=> new Date(b.ts)-new Date(a.ts))
      .map(a => `
        <tr>
          <td><strong>${a.id}</strong><div class="muted">${a.message}</div></td>
          <td>${fmt.sevChip(a.severity)}</td>
          <td>${a.locationName || ''}</td>
          <td>${a.projectName || ''}</td>
          <td>${a.unitName || ''}</td>
          <td>${a.wpName || ''}</td>
          <td>${fmt.rel(a.ts)}</td>
          <td>${a.acknowledged?'<span class="chip success">Acknowledged</span>':'<span class="chip warn">Open</span>'}</td>
          ${actionable ? `<td class="row-actions"><button class="btn secondary" onclick="Views._toggleAck('${a.id}')">${a.acknowledged?'Undo':'Acknowledge'}</button></td>`:''}
        </tr>
      `).join('');
    return `
      <div class="table-scroll">
        <table class="list">
          <thead><tr><th>ID</th><th>Severity</th><th>Location</th><th>Project</th><th>Unit</th><th>Water project</th><th>When</th><th>Status</th>${actionable?'<th></th>':''}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _toggleAck(id){
    for(const L of db.locations){
      for(const PJ of L.projects){
        for(const U of PJ.units){
          for(const WP of U.waterProjects){
            const a = (WP.alarms||[]).find(x=>x.id===id);
            if(a){
              a.acknowledged = !a.acknowledged; State.save(db);
              // Re-render current view in place
              window.dispatchEvent(new HashChangeEvent('hashchange'));
              return;
            }
          }
        }
      }
    }
  },

  _toggleTest(btn){
    const [label, state] = btn.textContent.split(':').map(s=>s.trim());
    const on = state !== 'On';
    btn.textContent = `${label}: ${on ? 'On' : 'Off'}`;
    btn.classList.toggle('on', on);
  },

  _bindKpiClicks(){
    document.querySelectorAll('.kpi.clickable').forEach(k=>{
      const setFilter = ()=>{
        UI.dashFilter = k.dataset.filter;
        Views.dashboard(document.getElementById('view'));
      };
      k.addEventListener('click', setFilter);
      k.addEventListener('keydown', e=>{
        if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setFilter(); }
      });
    });
  },

  _bindRowClicks(){
    const open = r => {
      if(r.dataset.wp) Router.go(`#/wp/${encodeURIComponent(r.dataset.wp)}`);
      else if(r.dataset.unit) Router.go(`#/unit/${encodeURIComponent(r.dataset.unit)}`);
      else if(r.dataset.project) Router.go(`#/project/${encodeURIComponent(r.dataset.project)}`);
      else if(r.dataset.location) Router.go(`#/location/${encodeURIComponent(r.dataset.location)}`);
    };
    document.querySelectorAll('.risk-row').forEach(r=>{
      // Clicks on links inside a row navigate to that object, not to the row target
      r.addEventListener('click', e=>{ if(e.target.closest('a')) return; open(r); });
      r.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.target.closest('a')) open(r); });
    });
  }
};

/* =============== SEARCH WIRING =============== */
document.getElementById('globalSearch').addEventListener('input', ()=>{
  const hash = location.hash.replace('#','');
  const [base] = (hash || '/dashboard').split('/').filter(Boolean);
  const el = document.getElementById('view');
  if(base==='locations' || base==='location') Views.locations(el);
  else if(base==='projects' || base==='project') Views.projects(el);
  else if(base==='units' || base==='unit') Views.units(el);
  else if(base==='waterprojects' || base==='wp') Views.waterprojects(el);
  else if(base==='alarms') Views.alarms(el);
  else Views.dashboard(el);
});

/* =============== MOVE SEARCH INTO MENU ON MOBILE =============== */
(() => {
  const searchEl = document.querySelector('label.search');
  const headerInner = document.querySelector('.header-inner');
  const slot = document.getElementById('menuSearchSlot');
  const mqMobile = window.matchMedia('(max-width:680px)');

  function placeSearch(){
    if(!searchEl || !headerInner || !slot) return;
    if(mqMobile.matches){
      if(searchEl.parentElement !== slot) slot.appendChild(searchEl);
    }else{
      if(searchEl.parentElement !== headerInner){
        const firstIcon = headerInner.querySelector('.icon-btn');
        headerInner.insertBefore(searchEl, firstIcon || null);
      }
    }
  }
  mqMobile.addEventListener('change', placeSearch);
  placeSearch();
})();

/* =============== MOBILE SIDEBAR OPEN/CLOSE =============== */
(() => {
  const navToggle = document.getElementById('navToggle');
  const sidebar   = document.getElementById('sidebar');
  const scrim     = document.getElementById('scrim');
  const mqMobile  = window.matchMedia('(max-width:680px)');

  const closeSidebar = () => { document.body.classList.remove('side-open'); navToggle?.setAttribute('aria-expanded','false'); if(scrim) scrim.hidden = true; };
  const openSidebar = () => { if(!mqMobile.matches) return; document.body.classList.add('side-open'); navToggle?.setAttribute('aria-expanded','true'); if(scrim) scrim.hidden = false; };
  const toggleSidebar = () => document.body.classList.contains('side-open') ? closeSidebar() : openSidebar();

  navToggle?.addEventListener('click', toggleSidebar);
  scrim?.addEventListener('click', closeSidebar);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });
  window.addEventListener('hashchange', closeSidebar);
  window.addEventListener('resize', () => { if (!mqMobile.matches) closeSidebar(); });
  sidebar?.addEventListener('click', e => { if (e.target.closest('a')) closeSidebar(); });
})();

/* =============== ROUTES =============== */
Router.on('/dashboard', Views.dashboard);
Router.on('/locations', Views.locations);
Router.on('/projects', Views.projects);
Router.on('/units', Views.units);
Router.on('/waterprojects', Views.waterprojects);
Router.on('/alarms', Views.alarms);
Router.start();
