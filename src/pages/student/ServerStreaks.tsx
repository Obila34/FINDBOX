import { useEffect, useState } from "react";
import { api } from "@/platform/api";
import { StreakView } from "./Streaks";
type Data = { days: string[]; today: string };
export function ServerStreaks({
  personId,
  embedded = false,
}: {
  personId: string;
  embedded?: boolean;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      api<Data>("/streaks")
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [personId]);
  async function checkIn() {
    setBusy(true);
    setError("");
    try {
      await api("/streaks/check-in", {});
      setData(await api<Data>("/streaks"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section role="status">
        <p>{error || "Loading your streak…"}</p>
        {error && (
          <button onClick={() => window.location.reload()}>Try again</button>
        )}
      </section>
    );
  return (
    <StreakView
      embedded={embedded}
      personId={personId}
      days={data.days}
      today={data.today}
      onCheckIn={checkIn}
      busy={busy}
      error={error}
      connected
    />
  );
}
