import { useEffect, useRef } from "react";
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}
export function Turnstile({
  siteKey,
  onToken,
  attempt,
  action = "signup",
}: {
  siteKey: string;
  onToken: (token: string) => void;
  attempt: number;
  // Checked by the server, so a token from one form does not pass another.
  action?: "signup" | "reset";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    if (!siteKey) return;
    let active = true,
      id: string | undefined;
    let timer: ReturnType<typeof setTimeout>;
    function mount() {
      if (!active) return;
      if (window.turnstile && ref.current) {
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: "auto",
          callback: (t: string) => callback.current(t),
          "expired-callback": () => callback.current(""),
          "error-callback": () => callback.current(""),
        });
      } else timer = setTimeout(mount, 100);
    }
    if (!document.querySelector("script[data-turnstile]")) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.turnstile = "true";
      document.head.appendChild(script);
    }
    mount();
    return () => {
      active = false;
      clearTimeout(timer);
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, attempt, action]);
  return <div ref={ref} className="turnstile" />;
}
