/** Server-rendered, page-shaped loading furniture. No timers or invented progress. */
type WaitShape =
  | "feed"
  | "flow"
  | "grid"
  | "list"
  | "profile"
  | "settings"
  | "conversation"
  | "rail-list"
  | "search"
  | "canvas"
  | "analytics"
  | "composer"
  | "connections"
  | "communities"
  | "page";

function Well({ w, h, radius, className = "" }: { w?: string; h: string; radius?: string; className?: string }) {
  return <span className={`paper-well ${className}`.trim()} style={{ width: w ?? "100%", height: h, borderRadius: radius }} />;
}

function AvatarRow({ lines = 2 }: { lines?: number }) {
  return (
    <div className="wait-identity">
      <Well w="2.75rem" h="2.75rem" radius="50%" />
      <div className="wait-lines">
        <Well w="42%" h="0.65rem" />
        {lines > 1 ? <Well w="26%" h="0.45rem" /> : null}
      </div>
    </div>
  );
}

function FeedCard({ media }: { media: boolean }) {
  return (
    <div className="paper-wait-card wait-feed-card">
      <AvatarRow />
      <div className="wait-lines"><Well w="90%" h="0.65rem" /><Well w="62%" h="0.65rem" /></div>
      {media ? <Well h="clamp(12rem, 30vw, 23rem)" radius="1rem" className="wait-media" /> : null}
      <div className="wait-action-row"><Well w="3rem" h="1.35rem" radius="999px" /><Well w="3rem" h="1.35rem" radius="999px" /><Well w="1.35rem" h="1.35rem" radius="50%" /></div>
    </div>
  );
}

function Rows({ count = 5 }: { count?: number }) {
  return <div className="wait-row-list">{Array.from({ length: count }, (_, i) => <div key={i} className="paper-wait-row"><AvatarRow lines={i % 3 === 0 ? 1 : 2} /><Well w="1.5rem" h="0.45rem" /></div>)}</div>;
}

function ShapeBody({ shape }: { shape: WaitShape }) {
  switch (shape) {
    case "feed":
      return <div className="wait-feed"><div className="paper-wait-card wait-compose-strip"><AvatarRow lines={1} /><Well w="5rem" h="2rem" radius="999px" /></div><FeedCard media /><FeedCard media={false} /></div>;
    case "flow":
      return <div className="wait-flow"><div className="wait-flow-caption"><AvatarRow /><Well w="74%" h="0.7rem" /><Well w="50%" h="0.55rem" /></div><div className="wait-flow-rail">{[0, 1, 2].map(i => <Well key={i} w="2.75rem" h="2.75rem" radius="50%" />)}</div></div>;
    case "grid":
    case "communities":
      return <div className="wait-discovery-grid">{Array.from({ length: 6 }, (_, i) => <div className="paper-wait-card wait-tile-card" key={i}><Well h="0" className="paper-well-tile" /><Well w={i % 2 ? "68%" : "48%"} h="0.75rem" /><Well w="82%" h="0.5rem" /></div>)}</div>;
    case "list":
    case "rail-list":
      return <div className="paper-wait-card wait-list-card"><Rows count={shape === "rail-list" ? 7 : 6} /></div>;
    case "profile":
      return <div className="wait-profile"><div className="wait-profile-cover"><Well h="100%" radius="0" /></div><div className="wait-profile-identity"><Well w="6.5rem" h="6.5rem" radius="50%" /><div className="wait-lines"><Well w="45%" h="1.15rem" /><Well w="28%" h="0.6rem" /></div></div><div className="wait-profile-bio"><Well w="72%" h="0.6rem" /><Well w="52%" h="0.6rem" /></div><div className="wait-tab-row">{[0, 1, 2].map(i => <Well key={i} w="5rem" h="1.5rem" radius="999px" />)}</div><div className="wait-profile-grid">{Array.from({ length: 6 }, (_, i) => <Well key={i} h="0" className="paper-well-tile" />)}</div></div>;
    case "settings":
      return <div className="wait-settings"><div className="wait-settings-rail"><Well w="60%" h="0.55rem" />{Array.from({ length: 6 }, (_, i) => <Well key={i} h="2.4rem" radius="0.75rem" />)}</div><div className="wait-settings-body">{[0, 1, 2].map(section => <div key={section} className="paper-wait-card wait-setting-card"><Well w="35%" h="0.9rem" />{[0, 1, 2].map(row => <div className="wait-setting-row" key={row}><div className="wait-lines"><Well w="48%" h="0.65rem" /><Well w="75%" h="0.45rem" /></div><Well w="2.5rem" h="1.4rem" radius="999px" /></div>)}</div>)}</div></div>;
    case "conversation":
      return <div className="wait-conversation"><div className="wait-conversation-header"><AvatarRow /></div><div className="wait-bubbles">{[{ mine: false, w: "58%" }, { mine: true, w: "40%" }, { mine: false, w: "32%" }, { mine: true, w: "63%" }].map((bubble, i) => <div key={i} className={`wait-bubble ${bubble.mine ? "wait-bubble-mine" : ""}`}><Well w={bubble.w} h={i === 0 ? "4.5rem" : "3rem"} radius="1.25rem" /></div>)}</div><div className="wait-message-input"><Well h="3.25rem" radius="1.2rem" /></div></div>;
    case "search":
      return <div className="wait-search"><Well h="3.5rem" radius="1.1rem" /><div className="wait-tab-row">{[0, 1, 2, 3].map(i => <Well key={i} w="4.5rem" h="1.75rem" radius="999px" />)}</div><div className="paper-wait-card wait-list-card"><Rows /></div></div>;
    case "canvas":
      return <div className="wait-canvas"><div className="wait-canvas-orbit" /><div className="wait-canvas-orbit wait-canvas-orbit-outer" />{[0, 1, 2, 3, 4].map(i => <span className={`wait-canvas-node wait-canvas-node-${i}`} key={i} />)}</div>;
    case "analytics":
      return <div className="wait-analytics"><div className="wait-stat-grid">{[0, 1, 2].map(i => <div className="paper-wait-card wait-stat" key={i}><Well w="55%" h="0.6rem" /><Well w="40%" h="1.75rem" /><Well w="70%" h="0.4rem" /></div>)}</div><div className="paper-wait-card wait-chart"><Well w="28%" h="0.9rem" /><div className="wait-chart-bars">{[28, 42, 35, 64, 52, 70, 58, 84, 72, 91, 81, 100].map((h, i) => <Well key={i} h={`${h}%`} />)}</div></div></div>;
    case "composer":
      return <div className="paper-wait-card wait-composer"><AvatarRow /><div className="wait-lines"><Well w="72%" h="0.8rem" /><Well w="40%" h="0.8rem" /></div><Well h="10rem" radius="1rem" /><div className="wait-compose-strip"><div className="wait-action-row"><Well w="2rem" h="2rem" radius="50%" /><Well w="2rem" h="2rem" radius="50%" /></div><Well w="6rem" h="2.5rem" radius="999px" /></div></div>;
    case "connections":
      return <div className="wait-connections">{[0, 1, 2, 3].map(i => <div className="paper-wait-card wait-connected-card" key={i}><Well w="3rem" h="3rem" radius="0.9rem" /><div className="wait-lines"><Well w="58%" h="0.75rem" /><Well w="80%" h="0.5rem" /></div><Well w="4.5rem" h="2rem" radius="999px" /></div>)}</div>;
    case "page":
    default:
      return <div className="wait-page"><div className="paper-wait-card wait-page-feature"><Well w="45%" h="1.5rem" /><Well w="70%" h="0.65rem" /><Well w="52%" h="0.65rem" /><Well w="7rem" h="2.5rem" radius="999px" /></div><div className="wait-page-grid">{[0, 1].map(i => <div className="paper-wait-card wait-page-detail" key={i}><Well w="2.5rem" h="2.5rem" radius="0.8rem" /><Well w="60%" h="0.8rem" /><Well h="0.5rem" /><Well w="75%" h="0.5rem" /></div>)}</div></div>;
  }
}

export function RouteWait({ shape = "page", label = "Loading", className = "" }: { shape?: WaitShape; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-wait-shape={shape} className={`paper-wait-route ${className}`.trim()}>
      <div className="wait-route-heading" aria-hidden="true"><span className="wait-route-emblem"><i /><i /></span><span>{label}</span></div>
      <div className="wait-route-body" aria-hidden="true"><ShapeBody shape={shape} /></div>
    </div>
  );
}
