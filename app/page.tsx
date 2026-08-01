"use client";

import { AnimatePresence, motion } from "framer-motion";
import { OnboardingFlow } from "@/components/ascend/OnboardingFlow";
import { Discover } from "@/components/ascend/Discover";
import { useEngine } from "@/hooks/use-engine";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function Home() {
  const engine = useEngine();

  return (
    <AnimatePresence mode="wait">
      {!engine.profile || !engine.state ? (
        <motion.div
          key="onboarding"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <OnboardingFlow onComplete={engine.start} />
        </motion.div>
      ) : (
        <motion.div
          key="discover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <Discover
            state={engine.state}
            profile={engine.profile}
            ccs={engine.ccs}
            onSwipe={engine.swipe}
            onResurface={engine.resurface}
            activeInsight={engine.activeInsight}
            onApplyInsight={engine.applyActiveInsight}
            onDismissInsight={engine.dismissInsight}
            toast={engine.toast}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
