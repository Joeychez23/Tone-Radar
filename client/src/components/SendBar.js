import { useState } from "react";
import Icon, { TierIcon } from "./Icon";

// "Fix the red sentences before you hit send": counts what's left, jumps to
// the next hot sentence, and gates the copy-to-send action.
export default function SendBar({ counts, onFixNext, onSend, disabled, stale }) {
  const [confirming, setConfirming] = useState(false);
  const hot = counts.hot;
  const warm = counts.warm;

  const send = () => {
    if (hot > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onSend();
  };

  let summary;
  if (!counts.analyzed) summary = "Write something to check it";
  else if (hot) summary = `${hot} hot sentence${hot === 1 ? "" : "s"} left`;
  else if (warm) summary = `No hot sentences · ${warm} warm`;
  else summary = "Every sentence is cool";

  return (
    <div className={`sendbar ${hot ? "has-hot" : counts.analyzed ? "is-clear" : ""}`}>
      <div className="sendbar-summary">
        {counts.analyzed > 0 && <TierIcon tier={hot ? "hot" : warm ? "warm" : "cool"} size={16} />}
        <span>{summary}</span>
        {stale && <span className="muted small">· updating…</span>}
      </div>
      <div className="sendbar-actions">
        {hot + warm > 0 && (
          <button className="btn" onClick={onFixNext}>
            <Icon name="wand" size={15} /> Fix next
          </button>
        )}
        {confirming ? (
          <>
            <span className="small warn-text">Send with {hot} hot?</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
              Keep editing
            </button>
            <button className="btn btn-danger" onClick={send}>
              Copy anyway
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={send} disabled={disabled}>
            <Icon name="copy" size={15} /> Copy &amp; send
          </button>
        )}
      </div>
    </div>
  );
}
