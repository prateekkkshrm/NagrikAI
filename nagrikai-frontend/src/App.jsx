import React, { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, Bell, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  CloudSun, Compass, Copy, FileText, Filter, Globe2, Headphones, Home,
  Info, Languages, Layers, LocateFixed, LockKeyhole, Map, MapPin, Menu,
  Mic, MicOff, Moon, Navigation, Plus, Search, Send, Settings, Shield,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, TrendingUp, User, Users,
  Volume2, WifiOff, X, Camera, Image as ImageIcon, MessageCircle, BarChart3
} from "lucide-react";

const GREEN = "#28d7a0";
const screens = [
  "Splash","Welcome","Language","Login","OTP verification","Home","Explore map","Map filters",
  "Capture report","Review report","Possible duplicate","Report submitted","Issue details",
  "GroundTruth AI","Responsible authority","Complaint handoff","Reference tracking","Weather & air",
  "Ask NagrikAI","Voice assistant","Civic navigation","City analytics","Profile","Report history",
  "Notifications","Accessibility","Privacy & settings","Loading","Empty history","Connection error"
];

const navItems = [
  {id:"Home", label:"Home", icon:Home},
  {id:"Explore map", label:"Explore", icon:Map},
  {id:"Capture report", label:"Report", icon:Plus},
  {id:"Ask NagrikAI", label:"Ask AI", icon:Sparkles},
  {id:"Profile", label:"Profile", icon:User}
];

function App() {
  const [screen, setScreen] = useState("Splash");
  const [language, setLanguage] = useState("English");
  const [phone, setPhone] = useState("98765 43210");
  const [otp, setOtp] = useState(["2","4","8","0","1","6"]);
  const [category, setCategory] = useState("Roads");
  const [severity, setSeverity] = useState("High");
  const [filters, setFilters] = useState(["Potholes & damaged roads","Waterlogging"]);
  const [distance, setDistance] = useState("2 km");
  const [issue, setIssue] = useState("Pothole on Alpha II main road");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [recording, setRecording] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [privacy, setPrivacy] = useState(true);
  const [accessibility, setAccessibility] = useState({motion:true, contrast:true, text:false, voice:false});
  const [reportCount, setReportCount] = useState(8);
  const [selectedTab, setSelectedTab] = useState("Home");

  const go = (name) => {
    setScreen(name);
    const nav = navItems.find(n => n.id === name);
    if (nav) setSelectedTab(nav.id);
    window.scrollTo?.(0,0);
  };
  const notify = (msg) => {
    setToast(msg);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(""), 2400);
  };
  const toggleFilter = (name) => setFilters(v => v.includes(name) ? v.filter(x => x !== name) : [...v,name]);
  const submitReport = () => { setReportCount(v=>v+1); go("Report submitted"); };
  const nav = (id) => { setSelectedTab(id); go(id); };

  return <div className="app-shell">
    <div className="device">
      <div className="status"><span>9:41 ▮▮▮</span><span>5G ◉ ▰</span></div>
      <main className="screen-content">
        {screen === "Splash" && <Splash go={go}/>}
        {screen === "Welcome" && <Welcome go={go}/>}
        {screen === "Language" && <Language language={language} setLanguage={setLanguage} go={go}/>}
        {screen === "Login" && <Login phone={phone} setPhone={setPhone} go={go} notify={notify}/>}
        {screen === "OTP verification" && <OTP otp={otp} setOtp={setOtp} go={go} notify={notify}/>}
        {screen === "Home" && <HomeScreen go={go} reportCount={reportCount} notify={notify}/>}
        {screen === "Explore map" && <ExploreMap go={go} query={query} setQuery={setQuery}/>}
        {screen === "Map filters" && <MapFilters filters={filters} toggleFilter={toggleFilter} distance={distance} setDistance={setDistance} go={go}/>}
        {screen === "Capture report" && <CaptureReport issue={issue} setIssue={setIssue} category={category} setCategory={setCategory} go={go} notify={notify}/>}
        {screen === "Review report" && <ReviewReport issue={issue} category={category} severity={severity} setSeverity={setSeverity} go={go}/>}
        {screen === "Possible duplicate" && <Duplicate go={go} issue={issue}/>}
        {screen === "Report submitted" && <Submitted go={go}/>}
        {screen === "Issue details" && <IssueDetails go={go} issue={issue}/>}
        {screen === "GroundTruth AI" && <GroundTruth go={go}/>}
        {screen === "Responsible authority" && <Authority go={go}/>}
        {screen === "Complaint handoff" && <Handoff go={go} notify={notify}/>}
        {screen === "Reference tracking" && <Tracking go={go}/>}
        {screen === "Weather & air" && <Weather go={go}/>}
        {screen === "Ask NagrikAI" && <AskAI go={go} query={query} setQuery={setQuery}/>}
        {screen === "Voice assistant" && <Voice recording={recording} setRecording={setRecording} go={go}/>}
        {screen === "Civic navigation" && <NavigationScreen go={go}/>}
        {screen === "City analytics" && <Analytics go={go}/>}
        {screen === "Profile" && <Profile go={go} reportCount={reportCount}/>}
        {screen === "Report history" && <History go={go}/>}
        {screen === "Notifications" && <Notifications go={go} enabled={notifications} setEnabled={setNotifications}/>}
        {screen === "Accessibility" && <Accessibility go={go} values={accessibility} setValues={setAccessibility}/>}
        {screen === "Privacy & settings" && <Privacy go={go} privacy={privacy} setPrivacy={setPrivacy}/>}
        {screen === "Loading" && <Loading go={go}/>}
        {screen === "Empty history" && <Empty go={go}/>}
        {screen === "Connection error" && <Offline go={go}/>}
      </main>
      {!["Splash","Welcome","Language","Login","OTP verification"].includes(screen) &&
        <BottomNav selected={selectedTab} nav={nav}/>}
      {toast && <div className="toast"><CheckCircle2 size={15}/>{toast}</div>}
    </div>
    <aside className="screen-index">
      <div className="index-head"><div className="brand-mark small">N</div><div><b>NagrikAI</b><small>Prototype navigation</small></div></div>
      <p className="index-caption">ALL 30 SCREENS</p>
      <div className="index-grid">{screens.map((s,i)=><button key={s} className={screen===s?"active":""} onClick={()=>go(s)}><span>{String(i+1).padStart(2,"0")}</span>{s}</button>)}</div>
      <p className="index-note">Use this panel to preview every designed screen. The bottom navigation and in-screen actions are also connected.</p>
    </aside>
  </div>;
}

function StatusBarTitle({title, back, right}) {
  return <div className="topbar">{back ? <button className="icon-btn" onClick={back}><ChevronLeft size={19}/></button> : <span/>}<b>{title}</b>{right || <span/>}</div>;
}
function Button({children,onClick,secondary=false,disabled=false}) {
  return <button className={`btn ${secondary?"secondary":""}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function Card({children,className=""}) { return <section className={`panel ${className}`}>{children}</section>; }
function Label({children}) { return <div className="eyebrow">{children}</div>; }
function Field({label,value,onChange,placeholder}) { return <label className="field"><span>{label}</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></label>; }
function BottomNav({selected,nav}) {
  return <nav className="bottom-nav">{navItems.map(({id,label,icon:Icon})=><button key={id} className={`${selected===id?"selected":""} ${id==="Capture report"?"report-nav":""}`} onClick={()=>nav(id)}><Icon size={17}/><small>{label}</small></button>)}</nav>;
}
function Splash({go}) {
  return <div className="center-page splash"><div className="brand-mark">N</div><h1>NagrikAI</h1><p>Your City. Your Voice.<br/>Your Intelligence.</p><div className="micro-line">GREATER NOIDA&nbsp; / &nbsp;CIVIC INTELLIGENCE</div><div className="bottom-action"><Button onClick={()=>go("Welcome")}>Get started</Button></div></div>;
}
function Welcome({go}) {
  return <div className="page"><Label>YOUR CITY, DECODED.</Label><div className="city-hero"><div className="tiny-coord">28.4744° N&nbsp; 77.5040° E</div><div className="brand-mark">N</div><b>GREATER NOIDA</b><div className="stat-row"><span>AIR 186</span><span>CITY 72</span><span>24° C</span></div></div><h1>A smarter city starts<br/>with you.</h1><p className="muted">Spot what matters. Report with proof.<br/>Let civic intelligence handle the noise.</p><Card><p>01 &nbsp; See beyond the traffic</p><p>02 &nbsp; Turn evidence into action</p><p>03 &nbsp; Know what changed — and what didn't</p></Card><div className="bottom-action"><Button onClick={()=>go("Language")}>Continue</Button></div></div>;
}
function Language({language,setLanguage,go}) {
  return <div className="page"><StatusBarTitle title="Choose your language" back={()=>go("Welcome")}/><Label>01 / 03 &nbsp; PERSONALISE</Label><h1>Your city.<br/>Your language.</h1><p className="muted">Choose how NagrikAI speaks to you. You can change this anytime.</p>{["English","हिन्दी"].map(v=><button className={`choice ${language===v?"chosen":""}`} onClick={()=>setLanguage(v)} key={v}><span>{v}</span><small>{v==="English"?"Selected language":"हिन्दी • सरल भाषा में"}</small>{language===v&&<Check size={17}/>}</button>)}<p className="hint">All conversations support both English and Hindi, including voice input.</p><div className="bottom-action"><Button onClick={()=>go("Login")}>Continue in {language}</Button></div></div>;
}
function Login({phone,setPhone,go,notify}) {
  return <div className="page"><StatusBarTitle title="Welcome to NagrikAI" back={()=>go("Language")}/><Label>02 / 03 &nbsp; SECURE SIGN-IN</Label><h1>One number.<br/>A stronger voice.</h1><p className="muted">Track your reports and get updates that actually matter.</p><Field label="MOBILE NUMBER" value={phone} onChange={setPhone}/><Button onClick={()=>{go("OTP verification");notify("Verification code sent");}}>Send verification code</Button><Card><b>Your number stays private.</b><p className="muted">Public reports never show your phone number. Your location is shared only with your consent.</p></Card><p className="hint">By continuing, you accept the Terms of Service and Privacy Policy.</p><Button secondary onClick={()=>go("Home")}>Explore without signing in</Button></div>;
}
function OTP({otp,setOtp,go,notify}) {
  return <div className="page"><StatusBarTitle title="Verify your number" back={()=>go("Login")}/><Label>03 / 03 &nbsp; VERIFY</Label><h1>Check your messages.</h1><p className="muted">Enter the 6-digit code sent to<br/>+91 98765 43210</p><div className="otp-row">{otp.map((v,i)=><input key={i} maxLength="1" value={v} onChange={e=>setOtp(a=>a.map((x,j)=>i===j?e.target.value.slice(-1):x))}/>)}</div><Button onClick={()=>{go("Home");notify("Phone number verified");}}>Verify & enter city</Button><Button secondary onClick={()=>notify("A new code has been sent")}>Resend code</Button><Card><b>A little security. A lot of trust.</b><p className="muted">Your reports stay connected to you. Your identity stays yours.</p></Card></div>;
}
function HomeScreen({go,reportCount,notify}) {
  return <div className="page"><div className="home-heading"><div><Label>SUNDAY, 15 NOV 2026 • ALPHA II</Label><h2>Greater Noida</h2></div><button className="icon-btn" onClick={()=>go("Notifications")}><Bell size={18}/></button></div><Card className="weather-card"><div><strong>24°</strong><span>Mostly sunny</span></div><small>Hazy sunshine<br/>H 27° / L 16°</small><p className="muted">AIR QUALITY • MODERATE</p></Card><Card className="insight"><b className="green">✦ Your city, in 20 seconds</b><p>Pari Chowk is moving slowly. AQI is rising. Take the Knowledge Park route and keep outdoor workouts light.</p></Card><Card><div className="split"><b>CITY HEALTH INDEX</b><span className="green">↑ 4 this week</span></div><strong className="score">72 <small>/ 100</small></strong><div className="progress"><i style={{width:"72%"}}/></div><small className="muted">Improving</small></Card><Label>NEAR YOU • 2 ACTIVE ALERTS</Label><Card className="alert-card" onClick={()=>go("Issue details")}><b>Pothole · Alpha II main road</b><small>240 m away • 12 confirmations</small><span className="severity">High</span></Card><div className="quick-grid">{["Safer route","City trends","Ask AI"].map((x,i)=><button key={x} onClick={()=>go(["Civic navigation","City analytics","Ask NagrikAI"][i])}>{x}</button>)}</div><p className="hint">Sample city data • Updated just now</p></div>;
}
function MiniMap({onClick}) {
  return <div className="mini-map" onClick={onClick}><div className="map-grid"/><div className="road r1"/><div className="road r2"/><div className="road r3"/><div className="road r4"/><span className="map-label l1">ALPHA II</span><span className="map-label l2">KNOWLEDGE PARK</span><i className="pin p1">7</i><i className="pin p2">1</i><i className="pin p3">3</i></div>;
}
function ExploreMap({go,query,setQuery}) {
  return <div className="page"><div className="home-heading"><h2>Explore your city</h2><button className="icon-btn" onClick={()=>go("Notifications")}><Bell size={17}/></button></div><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a place, street or issue"/></div><div className="filter-row"><button>Traffic</button><button className="on">Hazards</button><button onClick={()=>go("Map filters")}>Filters 2</button></div><MiniMap onClick={()=>go("Issue details")}/><Card className="alert-card"><b>Pothole near Alpha II market</b><small>240 m away • High severity • 12 verified</small><div className="split"><span className="green">View issue</span><span onClick={()=>go("Civic navigation")}>Directions →</span></div></Card><p className="hint">Simulated map & traffic • Not for live navigation</p></div>;
}
function MapFilters({filters,toggleFilter,distance,setDistance,go}) {
  const opts=["Potholes & damaged roads","Waterlogging","Waste & sanitation","Street lighting"];
  return <div className="page"><StatusBarTitle title="Map layers & filters" back={()=>go("Explore map")}/><h1>A clearer view of your city.</h1><Label>SHOW ON MAP</Label><Card>{opts.map(x=><button className="filter-option" onClick={()=>toggleFilter(x)} key={x}><span>{x}</span><span className={filters.includes(x)?"green":""}>{filters.includes(x)?"✓":"○"}</span></button>)}</Card><Label>INTELLIGENCE LAYERS</Label><Card>{["Traffic flow","Issue density heatmap","Predicted waterlogging"].map((x,i)=><div className="filter-option" key={x}><span>{x}</span><span className="green">{i<2?"On":"Off"}</span></div>)}</Card><Label>DISTANCE</Label><div className="filter-row">{["500 m","2 km","5 km","City"].map(x=><button className={distance===x?"on":""} onClick={()=>setDistance(x)} key={x}>{x}</button>)}</div><Button onClick={()=>go("Explore map")}>Apply filters</Button><p className="hint">Heatmaps show sample report density, not verified risk.</p></div>;
}
function CaptureReport({issue,setIssue,category,setCategory,go,notify}) {
  return <div className="page"><StatusBarTitle title="Report an issue" back={()=>go("Home")}/><Label>01 / 03 &nbsp; CAPTURE EVIDENCE</Label><div className="camera-placeholder"><Camera size={32}/><b>Capture a clear photo</b><small>Keep the issue centred in the frame</small></div><Field label="ISSUE TITLE" value={issue} onChange={setIssue}/><Label>CATEGORY</Label><div className="chip-wrap">{["Roads","Water","Waste","Street lighting","Other"].map(x=><button className={`chip ${category===x?"on":""}`} key={x} onClick={()=>setCategory(x)}>{x}</button>)}</div><Card><div className="split"><b>Alpha II main road, Greater Noida</b><MapPin size={16}/></div><small className="muted">28.4744, 77.5040 • GPS is approximate</small></Card><Button onClick={()=>{notify("Photo attached (demo)");go("Review report");}}>Capture photo</Button><Button secondary onClick={()=>go("Review report")}><ImageIcon size={15}/> Choose from gallery</Button><p className="hint">Camera & GPS are simulated. Add device permissions and upload APIs for production.</p></div>;
}
function ReviewReport({issue,category,severity,setSeverity,go}) {
  return <div className="page"><StatusBarTitle title="Review your report" back={()=>go("Capture report")}/><Label>02 / 03 &nbsp; AI-ASSISTED REVIEW</Label><div className="camera-thumb"><Camera size={24}/><small>Evidence preview</small></div><Card><b className="green">✦ Pothole detected</b><p>94% model confidence • 3 damage clusters</p><small className="muted">You can correct the AI before submitting.</small></Card><Card><b>Category</b><p>{category}</p><b>Severity</b><div className="chip-wrap">{["Low","Medium","High"].map(x=><button className={`chip ${severity===x?"on":""}`} onClick={()=>setSeverity(x)} key={x}>{x}</button>)}</div><b>Issue description</b><p>{issue}</p></Card><Button onClick={()=>go("Possible duplicate")}>Check nearby duplicates</Button><Button secondary onClick={()=>go("Capture report")}>Retake photo</Button></div>;
}
function Duplicate({go,issue}) {
  return <div className="page"><StatusBarTitle title="A match nearby" back={()=>go("Review report")}/><Label>03 / 03 &nbsp; AVOID DUPLICATE REPORTS</Label><h1>Same problem.<br/>Stronger together.</h1><p className="muted">A similar report is 18 m from your location. Add your evidence to give it more weight.</p><Card><b>#GN-2048 · Pothole, Alpha II</b><p>Similarity <b className="green">91%</b></p><small className="muted">Reported 12 Nov • 12 community confirmations</small></Card><Button onClick={()=>go("Report submitted")}>Add evidence to this issue</Button><Button secondary onClick={()=>go("Report submitted")}>This is a different issue</Button><p className="hint">Duplicate detection is simulated. Your report is saved either way.</p></div>;
}
function Submitted({go}) {
  return <div className="page"><StatusBarTitle title="Your voice is on record" back={()=>go("Home")}/><Card className="success-card"><CheckCircle2 size={38}/><h2>Evidence added.</h2><p>Your report now supports #GN-2048.</p></Card><Card><b>The next step is accountability.</b><p>1 &nbsp; Evidence joins the community report</p><p>2 &nbsp; Responsible authority is identified</p><p>3 &nbsp; You choose an official complaint handoff</p></Card><Button onClick={()=>go("Reference tracking")}>View issue & timeline</Button><Button secondary onClick={()=>go("Responsible authority")}>Find responsible authority</Button><p className="hint">Saved in this prototype only. No real complaint has been filed.</p></div>;
}
function IssueDetails({go,issue}) {
  return <div className="page"><StatusBarTitle title="Issue #GN-2048" back={()=>go("Explore map")}/><Label>GN-2048 • MONITORING VERIFICATION</Label><h1>{issue}</h1><Card><b>12 people confirmed this</b><p>3 evidence photos • 240 m from you</p></Card><Card>{["12 Nov · Report received","13 Nov · Assigned to road maintenance","14 Nov · Repair requested / proof pending","15 Nov · Community review requested"].map(x=><p key={x}>• &nbsp;{x}</p>)}</Card><Button onClick={()=>go("GroundTruth AI")}>Check repair</Button><Button secondary onClick={()=>go("Responsible authority")}>Authority →</Button><Button secondary onClick={()=>go("Capture report")}>I still see this issue</Button></div>;
}
function GroundTruth({go}) {
  return <div className="page"><StatusBarTitle title="GroundTruth AI" back={()=>go("Issue details")}/><Label>EVIDENCE, NOT JUST A STATUS CHANGE</Label><h1>Was it actually fixed?</h1><p className="muted">Compare the claim with what's on the ground.</p><Card><small className="muted">BEFORE · 12 NOV</small><div className="evidence-box">Road damage detected</div><small className="muted">AFTER · 14 NOV</small><div className="evidence-box after">Latest image submitted</div><h3 className="green">Likely repaired · 88%</h3><p>Demo assessment only. Surface appears filled, but location match and durability need human review.</p><span className="severity">Pending</span></Card><Button onClick={()=>go("Capture report")}>Request on-site verification</Button><Button secondary onClick={()=>go("Issue details")}>Back to issue</Button><p className="hint">AI cannot certify a repair. A field review is required.</p></div>;
}
function Authority({go}) {
  return <div className="page"><StatusBarTitle title="Who owns this issue?" back={()=>go("Issue details")}/><Label>JURISDICTION MATCH • DEMO</Label><h1>The right desk.<br/>Not another dead end.</h1><Card><h3>Greater Noida Industrial Development Authority</h3><b className="green">Civil / Road Maintenance</b><p>Suggested for Alpha II internal roads based on location.</p><small className="muted">Jurisdiction confidence: 92% • Verify before submission</small></Card><Card><b>Ready to send</b><p>✓ GPS location & issue summary</p><p>✓ Timestamped photographic evidence</p><p>✓ Community confirmations</p></Card><Button onClick={()=>go("Complaint handoff")}>Prepare official complaint</Button><Button secondary onClick={()=>go("Reference tracking")}>Track an existing reference</Button></div>;
}
function Handoff({go,notify}) {
  return <div className="page"><StatusBarTitle title="Official complaint" back={()=>go("Responsible authority")}/><Label>REVIEW BEFORE YOU HAND OFF</Label><Card><b className="green">To: GNIDA · Road Maintenance</b><h3>Subject: Road damage near Alpha II market</h3><p>A deep pothole on Alpha II main road poses a risk to two-wheelers. Please inspect and repair the road surface.</p><small className="muted">Location: 28.4744, 77.5040</small></Card><Card><b>Share evidence and issue location</b><p className="muted">You will be redirected to the official portal for personal details, if required.</p></Card><Button onClick={()=>{notify("Demo handoff prepared");go("Reference tracking");}}>Simulate official handoff</Button><Button secondary onClick={()=>go("Responsible authority")}>Back to authority</Button><p className="hint">SIMULATED NOTIFICATION — no government portal connection.</p></div>;
}
function Tracking({go}) {
  return <div className="page"><StatusBarTitle title="Track your complaint" back={()=>go("Home")}/><Label>SAMPLE REFERENCE • NOT AN OFFICIAL RECEIPT</Label><Card><h2>DEMO/GN/2026/2048</h2><p>Road maintenance / Alpha II</p><small className="muted">Last synced: 15 Nov, 04:41 IST</small><span className="severity">Review due</span></Card><Card className="timeline">{["12 Nov · Civic report created","13 Nov · Assigned to maintenance","14 Nov · Repair claimed","15 Nov · Field review requested"].map((x,i)=><p key={x}><span className="green">{i===3?"◷":"✓"}</span> {x}</p>)}</Card><Button onClick={()=>go("GroundTruth AI")}>Check GroundTruth evidence</Button><Button secondary onClick={()=>go("Issue details")}>View original issue</Button><p className="hint">Status updates are illustrative, not live authority records.</p></div>;
}
function Weather({go}) {
  return <div className="page"><StatusBarTitle title="Weather & air" back={()=>go("Home")}/><Card className="weather-large"><div><strong>24°</strong><p>Greater Noida</p></div><div><CloudSun size={34}/><small>Hazy sunshine</small><small>Feels like 25°</small></div></Card><Label>TODAY'S FORECAST</Label><div className="forecast">{["NOW","12 PM","2 PM","4 PM","6 PM"].map((x,i)=><div key={x}><small>{x}</small><CloudSun size={18}/><b>{[24,26,27,25,21][i]}°</b></div>)}</div><Card><b>INDIA AQI</b><h1 className="amber">186</h1><p>Moderate • Sensitive groups: reduce prolonged outdoor activity.</p></Card><Card><b>Low rain. Local drainage still matters.</b><p className="muted">10% rain probability • 0.2 mm forecast</p></Card><p className="hint">Weather & AQI values are sample data. Not a live forecast or health advisory.</p></div>;
}
function AskAI({go,query,setQuery}) {
  return <div className="page"><StatusBarTitle title="Ask NagrikAI" back={()=>go("Home")}/><Label>✦ CITY-AWARE AI</Label><div className="chat-bubble user">How should I get to Pari Chowk today?</div><Card><b className="green">Skip the jam. Keep the morning.</b><p>From Alpha II, take the Knowledge Park route, add 8 min but avoids the reported pothole and slow traffic near Pari Chowk.</p><p>Pari Chowk is auctioning for a parking lot. Let's skip the role.</p><small className="muted">Based on 2 reports • Sample traffic data</small></Card><Button onClick={()=>go("Civic navigation")}>Show safer route</Button><Button secondary onClick={()=>go("Weather & air")}>What is the air quality like?</Button><div className="chat-input"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ask about your city..."/><button onClick={()=>{setQuery("");}}><Send size={17}/></button></div><p className="hint">AI responses are simulated in this frontend prototype.</p></div>;
}
function Voice({recording,setRecording,go}) {
  return <div className="page"><StatusBarTitle title="Speak your city" back={()=>go("Ask NagrikAI")}/><Label>VOICE MODE • ENGLISH / हिन्दी</Label><h1>Go ahead.<br/>I'm listening.</h1><button className={`voice-orb ${recording?"recording":""}`} onClick={()=>setRecording(!recording)}><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></button><p className="green center">{recording?"● Recording — tap to stop":"● Ready to review · 00:04"}</p><Card><b>TRANSCRIPT</b><p>“Alpha II se Pari Chowk jaane ka safer route batao.”</p></Card><Button onClick={()=>go("Civic navigation")}>Use this question</Button><Button secondary onClick={()=>setRecording(false)}>{recording?"Stop recording":"Cancel recording"}</Button><p className="hint">Microphone permission is not requested in this demo. Connect Web Speech API for live voice.</p></div>;
}
function NavigationScreen({go}) {
  return <div className="page"><StatusBarTitle title="Safer ways forward" back={()=>go("Explore map")}/><Card><small className="muted">FROM &nbsp; Alpha II market</small><b>TO &nbsp; Pari Chowk metro station</b></Card><MiniMap onClick={()=>go("Explore map")}/><Card><div className="split"><b>Via Knowledge Park • 4.6 km</b><b className="green">12 min</b></div><p className="muted">Avoids 1 pothole & a slow-traffic segment</p></Card><Card><div className="split"><b>Shortest · Alpha II road</b><span className="amber">18 min</span></div><p className="muted">3.0 km • 1 reported road hazard</p></Card><Button onClick={()=>go("Explore map")}>View hazards on route</Button><p className="hint">Routes and travel times are illustrative. Not for live navigation.</p></div>;
}
function Analytics({go}) {
  return <div className="page"><StatusBarTitle title="City intelligence" back={()=>go("Home")}/><Label>GREATER NOIDA / LAST 30 DAYS</Label><div className="metric-grid"><Card><strong>1,284</strong><small>Reports</small></Card><Card><strong>68%</strong><small>Resolved</small></Card><Card><strong>2.8d</strong><small>Median fix</small></Card></div><Card><div className="split"><b>REPORTS BY WEEK</b><span className="green">−18%</span></div><div className="bars">{[68,55,74,62].map((v,i)=><div key={i}><i style={{height:v+"%"}}/><small>W{i+1}</small></div>)}</div></Card><Card><b>Where the city needs attention</b><p>1 &nbsp; Pari Chowk <span className="right">86 reports</span></p><p>2 &nbsp; Alpha II <span className="right">54 reports</span></p><p>3 &nbsp; Surajpur <span className="right">39 reports</span></p></Card><p className="hint">Sample data • Not an official civic statistics source.</p></div>;
}
function Profile({go,reportCount}) {
  return <div className="page"><StatusBarTitle title="Your civic footprint" back={()=>go("Home")}/><Card className="profile-card"><div className="avatar">AS</div><h2>Aarav Sharma</h2><p>Alpha II, Greater Noida</p><small className="muted">Joined October 2026</small><span className="green">✦ Trusted contributor</span></Card><div className="metric-grid"><Card><strong>{reportCount}</strong><small>Reports</small></Card><Card><strong>5</strong><small>Resolved</small></Card><Card><strong>23</strong><small>Verifications</small></Card></div>{[["Your reports","Report history"],["Notifications","Notifications"],["Accessibility","Accessibility"],["Privacy & settings","Privacy & settings"],["Language / English & हिन्दी","Language"]].map(([x,y])=><button className="menu-row" key={x} onClick={()=>go(y)}>{x}<ChevronRight size={16}/></button>)}</div>;
}
function History({go}) {
  return <div className="page"><StatusBarTitle title="Your reports" back={()=>go("Profile")}/><Label>8 REPORTS • 5 RESOLVED • 3 OPEN</Label>{[["Pothole · Alpha II","Awaiting verification","15 Nov · #GN-2048"],["Streetlight · Sector Beta I","Assigned","13 Nov · #GN-2031"],["Waste pickup · Alpha II","Resolved","10 Nov · #GN-1982"],["Blocked drain · Delta I","Resolved","08 Nov · #GN-1946"]].map(([a,b,c],i)=><Card key={a} onClick={()=>go("Issue details")}><b>{a}</b><p className={i<2?"amber":"green"}>{b}</p><small className="muted">{c}</small></Card>)}<Button onClick={()=>go("Capture report")}>Report something new</Button><p className="hint">Preview of empty history → <a onClick={()=>go("Empty history")}>empty state</a></p></div>;
}
function Notifications({go,enabled,setEnabled}) {
  return <div className="page"><StatusBarTitle title="Notifications" back={()=>go("Profile")}/><Label>TODAY</Label>{[["Repair claimed. You decide.","New repair evidence for #GN-2048. Help verify it on the ground.","8 min ago"],["Your city briefing is ready","A clearer route, rising AQI, and the hazards near you.","34 min ago"],["Road hazard near Alpha II","A new community report is within 500 m of your saved area.","1 hour ago"]].map(([a,b,c])=><Card key={a}><b>{a}</b><p>{b}</p><small className="green">{c}</small></Card>)}<Card className="split"><b>Nearby alerts</b><button className={`switch ${enabled?"yes":""}`} onClick={()=>setEnabled(!enabled)}><i/></button></Card><p className="hint">Sample notifications • No push service connected</p></div>;
}
function Accessibility({go,values,setValues}) {
  const rows=[["text","Larger text","Adjust device's preferred text scale."],["motion","Reduce motion","Keep transitions and animations light."],["voice","Voice guidance","Read civic summaries and key actions aloud."],["contrast","High-contrast labels","Increase contrast on colour indicators."]];
  return <div className="page"><StatusBarTitle title="Made for everyone" back={()=>go("Profile")}/><h1>Comfort is not optional.</h1><p className="muted">Tune the interface to how you see, hear and move.</p>{rows.map(([id,title,desc])=><Card key={id}><div className="split"><b>{title}</b><button className={`switch ${values[id]?"yes":""}`} onClick={()=>setValues(v=>({...v,[id]:!v[id]}))}><i/></button></div><small className="muted">{desc}</small></Card>)}<Card><b>Road hazard ahead</b><p className="amber">High severity · 240 m away</p><small className="muted">Preview of an accessible alert card</small></Card></div>;
}
function Privacy({go,privacy,setPrivacy}) {
  return <div className="page"><StatusBarTitle title="Privacy & settings" back={()=>go("Profile")}/><Label>YOUR DATA, YOUR CALL</Label><Card><div className="split"><b>Precise location</b><button className={`switch ${privacy?"yes":""}`} onClick={()=>setPrivacy(!privacy)}><i/></button></div><p className="muted">Only while capturing a report or requesting a route.</p></Card><Card><div className="split"><b>Anonymous public reports</b><span className="green">On</span></div><p className="muted">Hide your name from the community.</p></Card><Card><div className="split"><b>Personalised AI suggestions</b><span className="muted">Off</span></div><p className="muted">Use saved areas and preferences, not private messages.</p></Card>{["Language / English & हिन्दी","Accessibility","Preview offline recovery"].map(x=><button className="menu-row" key={x} onClick={()=>go(x==="Accessibility"?x:"Language")}>{x}<ChevronRight size={16}/></button>)}<p className="hint">Prototype only. No real personal data is collected or transmitted.</p></div>;
}
function Loading({go}) {
  return <div className="page"><StatusBarTitle title="Syncing your city" back={()=>go("Home")}/><Label>GETTING THE LATEST CITY SNAPSHOT</Label>{[1,2,3].map(x=><Card key={x}><div className="skeleton long"/><div className="skeleton short"/><div className="skeleton medium"/></Card>)}<h3 className="green center">Connecting the dots...</h3><p className="muted center">Reports, weather and road conditions.<br/>Sample data for this prototype.</p><Button onClick={()=>go("Home")}>Continue to Home</Button></div>;
}
function Empty({go}) {
  return <div className="page"><StatusBarTitle title="Your reports" back={()=>go("Report history")}/><div className="empty-state"><FileText size={34}/><h2>No reports. Yet.</h2><p>A safer street can start with one well-documented report.</p></div><Button onClick={()=>go("Capture report")}>Make your first report</Button><Button secondary onClick={()=>go("Explore map")}>Explore issues near you</Button><Card><b>A useful report takes a minute.</b><p className="muted">Add a clear photo, confirm the location, and let AI help with the details.</p></Card></div>;
}
function Offline({go}) {
  return <div className="page"><StatusBarTitle title="You're offline" back={()=>go("Home")}/><div className="offline-icon"><WifiOff size={34}/></div><h1>Signal lost.<br/>Your voice isn't.</h1><p className="muted">I couldn't refresh your city feed. Check your connection and try again.</p><Card><b className="green">Last saved snapshot: 09:20 IST</b></Card><Button onClick={()=>go("Loading")}>Try again</Button><Button secondary onClick={()=>go("Home")}>View saved city snapshot</Button><Card><b>Your draft stays with you.</b><p className="muted">In the production app, pending reports are kept on-device until you reconnect.</p></Card></div>;
}

export default App;