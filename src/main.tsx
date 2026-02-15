import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";
import { registerSW } from "virtual:pwa-register";
import { WalletProviders } from "@/components/solana/WalletProviders";

if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      const swToast = toast({
        title: "Neue Version verfügbar",
        description: "Lade die neueste Version und starte die App erneut.",
        action: (
          <ToastAction
            onClick={() => {
              updateSW?.(true);
              swToast.dismiss();
            }}
          >
            Jetzt neu laden
          </ToastAction>
        ),
      });
    },
    onOfflineReady() {
      toast({
        title: "Offline bereit",
        description: "Die App kann nun ohne Netzwerkverbindung verwendet werden.",
      });
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <WalletProviders>
    <App />
  </WalletProviders>
);
