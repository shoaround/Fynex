<script setup lang="ts">
import { FUND_PRESETS } from "~/config/fund";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

const router = useRouter();

// Parallax hero
const heroOffset = ref(0);
onMounted(() => {
  const onScroll = () => {
    heroOffset.value = window.scrollY * 0.4;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onUnmounted(() => window.removeEventListener("scroll", onScroll));
});

const riskColors: Record<string, string> = {
  low: "bg-green-500/15 text-green-400 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  high: "bg-red-500/15 text-red-400 border-red-500/30",
};

// TradFi-friendly display names for vault IDs
const vaultDisplayNames: Record<string, string> = {
  yoUSD: "US Dollar",
  yoETH: "Ethereum",
  yoBTC: "Bitcoin",
};

const features = [
  {
    icon: "lucide:shield-check",
    title: "Your Money, Your Control",
    desc: "You always own your assets. Your funds are secured in audited, transparent smart contracts — never held by a third party.",
  },
  {
    icon: "lucide:pie-chart",
    title: "Instant Diversification",
    desc: "One deposit gets automatically spread across multiple assets. No need to manage each position yourself.",
  },
  {
    icon: "lucide:zap",
    title: "Near-Zero Fees",
    desc: "Transaction costs under $0.01. No management fees, no hidden charges, no lock-up periods.",
  },
  {
    icon: "lucide:repeat",
    title: "Easy Currency Exchange",
    desc: "Convert between currencies before investing. We find the best rate across multiple exchanges for you.",
  },
];

const steps = [
  { num: "1", icon: "lucide:log-in", title: "Create Account", desc: "Sign up with your email, Google, or connect an existing wallet. Takes less than a minute." },
  { num: "2", icon: "lucide:pie-chart", title: "Pick a Fund", desc: "Choose from 3 ready-made portfolios — or build your own with custom allocations." },
  { num: "3", icon: "lucide:arrow-up-circle", title: "Invest", desc: "Enter an amount and we'll automatically split it across your chosen portfolio." },
  { num: "4", icon: "lucide:trending-up", title: "Earn Returns", desc: "Your investment works around the clock. Track performance and withdraw anytime." },
];

const stats = [
  { label: "Asset Classes", value: "4" },
  { label: "Ready-Made Funds", value: "3" },
  { label: "Minimum Deposit", value: "$1" },
  { label: "Lock-Up Period", value: "None" },
];

const faqs = [
  {
    q: "What is Fynex?",
    a: "Fynex is a digital investment platform that works like a mutual fund. You pick a portfolio strategy, deposit money, and your investment is automatically diversified across multiple assets that earn returns over time.",
  },
  {
    q: "How does diversification work?",
    a: "When you invest, your deposit is automatically split across different asset types — Dollar, Euro, Ethereum, and Bitcoin — based on the percentages in your chosen fund. This reduces risk by not putting all your eggs in one basket.",
  },
  {
    q: "Is my money safe?",
    a: "Your assets are held in audited smart contracts — not by us or any third party. Only you can access and withdraw your funds. Think of it like a digital safety deposit box that also earns returns.",
  },
  {
    q: "Can I withdraw anytime?",
    a: "Yes, absolutely. There are no lock-up periods or exit fees. You can withdraw part or all of your investment at any time.",
  },
  {
    q: "What are the fees?",
    a: "There are no management fees. The only cost is a small network transaction fee, typically less than $0.01 per transaction.",
  },
  {
    q: "Do I need crypto experience?",
    a: "No. You can sign up with just an email address. If you already have a crypto wallet, you can connect that too. We've designed the experience to be as simple as using any banking app.",
  },
  {
    q: "Can I create my own portfolio?",
    a: "Yes. Besides the 3 ready-made funds (Conservative, Balanced, Aggressive), you can use sliders to create a custom allocation with whatever mix you prefer.",
  },
];

const openFaq = ref<number | null>(null);
const toggleFaq = (i: number) => {
  openFaq.value = openFaq.value === i ? null : i;
};

// Stagger delay helper
const stagger = (i: number, base = 100) => base + i * 100;
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Navbar -->
    <nav class="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div class="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/logo.png" alt="Fynex" class="w-8 h-8 rounded-full" />
          <span class="font-bold text-lg tracking-tight">Fynex</span>
        </div>
        <div class="flex items-center gap-3">
          <a href="#features" class="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#funds" class="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Funds</a>
          <a href="#faq" class="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          <Button @click="router.push('/app')" size="sm">Get Started</Button>
        </div>
      </div>
    </nav>

    <!-- Hero (parallax) -->
    <section class="relative overflow-hidden">
      <div
        class="absolute inset-0 bg-linear-to-b from-primary/5 via-transparent to-transparent"
        :style="{ transform: `translateY(${heroOffset * 0.5}px)` }"
      />
      <div class="max-w-4xl mx-auto px-4 pt-24 pb-20 text-center relative">
        <h1
          v-motion
          :initial="{ opacity: 0, y: 40 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 700, delay: 150 } }"
          class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight"
          :style="{ transform: `translateY(${heroOffset * -0.15}px)` }"
        >
          Investing Made
          <br />
          <span class="text-primary">Effortless</span>
        </h1>
        <p
          v-motion
          :initial="{ opacity: 0, y: 30 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 600, delay: 300 } }"
          class="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Pick a portfolio, deposit any amount, and start earning returns.
          Diversified funds, no minimums, withdraw anytime.
        </p>
        <div
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 500, delay: 500 } }"
          class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button size="lg" @click="router.push('/app')" class="px-8 text-base">
            Start Investing
          </Button>
          <Button variant="outline" size="lg" class="px-8 text-base">
            <a href="#how-it-works">How It Works</a>
          </Button>
        </div>
      </div>
    </section>

    <!-- Stats Bar -->
    <section class="border-y border-border/50 bg-secondary/30">
      <div class="max-w-4xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div
          v-for="(stat, i) in stats"
          :key="stat.label"
          v-motion
          :initial="{ opacity: 0, y: 20 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 400, delay: stagger(i) } }"
          class="text-center"
        >
          <div class="text-2xl font-bold text-primary">{{ stat.value }}</div>
          <div class="text-sm text-muted-foreground mt-1">{{ stat.label }}</div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="max-w-5xl mx-auto px-4 py-20">
      <div
        v-motion
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{ opacity: 1, y: 0, transition: { duration: 500 } }"
        class="text-center mb-12"
      >
        <h2 class="text-3xl font-bold tracking-tight">Why Fynex?</h2>
        <p class="text-muted-foreground mt-3">Simple, transparent investing for everyone</p>
      </div>
      <div class="grid sm:grid-cols-2 gap-6">
        <Card
          v-for="(f, i) in features"
          :key="f.title"
          v-motion
          :initial="{ opacity: 0, y: 40 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 500, delay: stagger(i, 50) } }"
          class="bg-secondary/30 border-border/50"
        >
          <CardContent class="pt-6">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon :name="f.icon" class="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 class="font-semibold text-base">{{ f.title }}</h3>
                <p class="text-sm text-muted-foreground mt-1 leading-relaxed">{{ f.desc }}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- How It Works -->
    <section id="how-it-works" class="bg-secondary/20 border-y border-border/50">
      <div class="max-w-2xl mx-auto px-4 py-20">
        <div
          v-motion
          :initial="{ opacity: 0, y: 30 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 500 } }"
          class="text-center mb-12"
        >
          <h2 class="text-3xl font-bold tracking-tight">How It Works</h2>
          <p class="text-muted-foreground mt-3">From sign-up to earning returns in minutes</p>
        </div>
        <div class="relative">
          <!-- Vertical line -->
          <div class="absolute left-6 top-6 bottom-6 w-px bg-border" />

          <div
            v-for="(step, i) in steps"
            :key="step.num"
            v-motion
            :initial="{ opacity: 0, x: -30 }"
            :visible-once="{ opacity: 1, x: 0, transition: { duration: 500, delay: stagger(i, 100) } }"
            class="relative flex gap-5"
            :class="i < steps.length - 1 ? 'pb-10' : ''"
          >
            <!-- Circle -->
            <div class="relative z-10 w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <Icon :name="step.icon" class="w-5 h-5 text-primary" />
            </div>
            <!-- Content -->
            <div class="pt-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono text-primary">Step {{ step.num }}</span>
              </div>
              <h3 class="font-semibold text-base mt-1">{{ step.title }}</h3>
              <p class="text-sm text-muted-foreground mt-1 leading-relaxed">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Fund Presets -->
    <section id="funds" class="max-w-5xl mx-auto px-4 py-20">
      <div
        v-motion
        :initial="{ opacity: 0, y: 30 }"
        :visible-once="{ opacity: 1, y: 0, transition: { duration: 500 } }"
        class="text-center mb-12"
      >
        <h2 class="text-3xl font-bold tracking-tight">Choose Your Portfolio</h2>
        <p class="text-muted-foreground mt-3">3 ready-made strategies for every risk appetite</p>
      </div>
      <div class="grid sm:grid-cols-3 gap-6">
        <Card
          v-for="(fund, i) in FUND_PRESETS"
          :key="fund.id"
          v-motion
          :initial="{ opacity: 0, y: 50, scale: 0.95 }"
          :visible-once="{ opacity: 1, y: 0, scale: 1, transition: { duration: 500, delay: stagger(i, 100) } }"
          class="bg-secondary/30 border-border/50 hover:border-primary/40 transition-colors"
        >
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-lg">{{ fund.name }}</CardTitle>
              <Badge variant="outline" :class="riskColors[fund.risk]" class="text-[10px] px-2">
                {{ fund.risk }} risk
              </Badge>
            </div>
            <CardDescription>{{ fund.description }}</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              <div
                v-for="(pct, vaultId) in fund.allocations"
                :key="vaultId"
                class="flex items-center justify-between text-sm"
              >
                <span class="text-muted-foreground">{{ vaultDisplayNames[vaultId] || vaultId }}</span>
                <div class="flex items-center gap-2">
                  <div class="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div class="h-full rounded-full bg-primary" :style="{ width: pct + '%' }" />
                  </div>
                  <span class="font-mono text-xs w-8 text-right">{{ pct }}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <div
        v-motion
        :initial="{ opacity: 0, y: 20 }"
        :visible-once="{ opacity: 1, y: 0, transition: { duration: 400, delay: 500 } }"
        class="text-center mt-8"
      >
        <Button variant="outline" @click="router.push('/app')" class="px-6">
          Or Build Your Own Portfolio
        </Button>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="bg-secondary/20 border-y border-border/50">
      <div class="max-w-3xl mx-auto px-4 py-20">
        <div
          v-motion
          :initial="{ opacity: 0, y: 30 }"
          :visible-once="{ opacity: 1, y: 0, transition: { duration: 500 } }"
          class="text-center mb-12"
        >
          <h2 class="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p class="text-muted-foreground mt-3">Everything you need to know</p>
        </div>
        <div class="space-y-2">
          <div
            v-for="(faq, i) in faqs"
            :key="i"
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :visible-once="{ opacity: 1, y: 0, transition: { duration: 400, delay: stagger(i, 50) } }"
            class="rounded-lg border border-border/50 overflow-hidden"
          >
            <button
              @click="toggleFaq(i)"
              class="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
            >
              <span class="font-medium text-sm">{{ faq.q }}</span>
              <Icon
                name="lucide:chevron-down"
                class="w-4 h-4 text-muted-foreground transition-transform duration-300 shrink-0 ml-4"
                :class="openFaq === i ? 'rotate-180' : ''"
              />
            </button>
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="max-h-0 opacity-0"
              enter-to-class="max-h-40 opacity-100"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="max-h-40 opacity-100"
              leave-to-class="max-h-0 opacity-0"
            >
              <div
                v-if="openFaq === i"
                class="px-5 pb-4 text-sm text-muted-foreground leading-relaxed overflow-hidden"
              >
                {{ faq.a }}
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-4xl mx-auto px-4 py-20 text-center">
      <div
        v-motion
        :initial="{ opacity: 0, scale: 0.95 }"
        :visible-once="{ opacity: 1, scale: 1, transition: { duration: 600 } }"
      >
        <h2 class="text-3xl font-bold tracking-tight">Ready to Grow Your Money?</h2>
        <p class="text-muted-foreground mt-3 max-w-xl mx-auto">
          Start with as little as $1. No experience needed, no lock-ups, no hidden fees.
        </p>
        <Button size="lg" @click="router.push('/app')" class="mt-8 px-10 text-base">
          Start Investing
        </Button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="border-t border-border/50 bg-secondary/20">
      <div class="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="/logo.png" alt="Fynex" class="w-6 h-6 rounded-full" />
          <span class="text-sm font-semibold">Fynex</span>
        </div>
        <p class="text-xs text-muted-foreground">
          Secured by smart contracts on Base network
        </p>
      </div>
    </footer>
  </div>
</template>
