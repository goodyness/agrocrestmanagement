import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, X, Smartphone } from "lucide-react";
import { toast } from "sonner";

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isInstalled && !localStorage.getItem('pwa-prompt-dismissed')) {
      // Show prompt after 3 seconds
      setTimeout(() => setShowPrompt(true), 3000);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App installed successfully!');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom duration-500">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="relative pb-3">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Install App</CardTitle>
              <CardDescription className="text-xs">Access faster & work offline</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isIOS ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>To install on iOS:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Tap the Share button <span className="inline-flex align-middle">📤</span></li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            <>
              <p className="text-sm text-muted-foreground">
                Install the app for quick access and offline functionality.
              </p>
              <Button onClick={handleInstall} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Install Now
              </Button>
            </>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>To install on Android:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Tap the menu (⋮) in your browser</li>
                <li>Select "Add to Home screen" or "Install app"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
