<script setup lang="ts">
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  login: [method: string, payload?: any];
}>();

type View = "main" | "email" | "wallet";

const view = ref<View>("main");
const email = ref("");
const otpCode = ref("");
const otpSent = ref(false);
const isLoading = ref(false);
const errorMsg = ref("");

const close = () => {
  emit("update:open", false);
  setTimeout(() => {
    view.value = "main";
    email.value = "";
    otpCode.value = "";
    otpSent.value = false;
    isLoading.value = false;
    errorMsg.value = "";
  }, 200);
};

const handleEmailSendCode = async () => {
  if (!email.value) return;
  isLoading.value = true;
  errorMsg.value = "";
  emit("login", "email:send-code", email.value);
};

const handleEmailVerify = async () => {
  if (!otpCode.value) return;
  isLoading.value = true;
  errorMsg.value = "";
  emit("login", "email:verify", { email: email.value, code: otpCode.value });
};

const handleOAuth = (provider: string) => {
  isLoading.value = true;
  errorMsg.value = "";
  emit("login", "oauth", provider);
};

const handleWallet = (type: "injected" | "walletconnect" | "coinbase") => {
  isLoading.value = true;
  errorMsg.value = "";
  emit("login", "wallet", type);
};

const setOtpSent = (val: boolean) => {
  otpSent.value = val;
  isLoading.value = false;
};

const setError = (msg: string) => {
  errorMsg.value = msg;
  isLoading.value = false;
};

const setLoading = (val: boolean) => {
  isLoading.value = val;
};

defineExpose({ setOtpSent, setError, setLoading, close });

const socialProviders = [
  { id: "google", label: "Google", icon: "logos:google-icon" },
  { id: "twitter", label: "X", icon: "simple-icons:x" },
  { id: "discord", label: "Discord", icon: "logos:discord-icon" },
];
</script>

<template>
  <Dialog :open="open" @update:open="(v: boolean) => v ? null : close()">
    <DialogContent class="sm:max-w-[680px] p-0 overflow-hidden">
      <div class="grid sm:grid-cols-5">
        <!-- Left: Branding panel -->
        <div class="hidden sm:flex sm:col-span-2 flex-col justify-between bg-gradient-to-br from-primary/20 via-primary/5 to-transparent p-6 border-r border-border">
          <div>
            <img src="/logo.png" alt="Fynex" class="w-10 h-10 rounded-lg mb-4" />
            <h2 class="text-lg font-bold tracking-tight">Welcome to Fynex</h2>
            <p class="text-sm text-muted-foreground mt-2 leading-relaxed">
              Simple investing, diversified returns. Get started in under a minute.
            </p>
          </div>
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="lucide:shield-check" class="w-3.5 h-3.5 text-primary" />
              <span>Non-custodial & secure</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="lucide:zap" class="w-3.5 h-3.5 text-primary" />
              <span>Instant portfolio access</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="lucide:lock" class="w-3.5 h-3.5 text-primary" />
              <span>No seed phrases needed</span>
            </div>
          </div>
        </div>

        <!-- Right: Login content -->
        <div class="sm:col-span-3 p-6 space-y-5">
          <!-- Header (mobile: show logo, desktop: just title) -->
          <div>
            <img src="/logo.png" alt="Fynex" class="w-8 h-8 rounded-lg mb-3 sm:hidden" />
            <h2 class="text-lg font-bold">
              {{ view === "main" ? "Sign in" : view === "email" ? "Email" : "Connect wallet" }}
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              {{
                view === "main"
                  ? "Choose how you'd like to continue"
                  : view === "email"
                    ? "We'll send you a verification code"
                    : "Select a wallet to connect"
              }}
            </p>
          </div>

          <!-- Error -->
          <p v-if="errorMsg" class="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{{ errorMsg }}</p>

          <!-- ══ Main View ══ -->
          <div v-if="view === 'main'" class="space-y-4">
            <!-- Email button -->
            <button
              @click="view = 'email'"
              class="w-full flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left"
            >
              <Icon name="lucide:mail" class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium">Continue with email</span>
            </button>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <Separator class="flex-1" />
              <span class="text-[11px] text-muted-foreground uppercase tracking-wider">or</span>
              <Separator class="flex-1" />
            </div>

            <!-- Social row -->
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="provider in socialProviders"
                :key="provider.id"
                @click="handleOAuth(provider.id)"
                :disabled="isLoading"
                class="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <Icon :name="provider.icon" class="w-4 h-4" />
                <span class="text-xs font-medium">{{ provider.label }}</span>
              </button>
            </div>

            <!-- Wallet section -->
            <div class="flex items-center gap-3">
              <Separator class="flex-1" />
              <span class="text-[11px] text-muted-foreground uppercase tracking-wider">wallet</span>
              <Separator class="flex-1" />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                @click="view = 'wallet'"
                class="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors"
              >
                <Icon name="lucide:wallet" class="w-4 h-4 text-muted-foreground" />
                <span class="text-xs font-medium">Browser Wallet</span>
              </button>
              <button
                @click="handleWallet('coinbase')"
                :disabled="isLoading"
                class="flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                <Icon name="simple-icons:coinbase" class="w-4 h-4 text-[#0052FF]" />
                <span class="text-xs font-medium">Smart Wallet</span>
              </button>
            </div>
          </div>

          <!-- ══ Email View ══ -->
          <div v-else-if="view === 'email'" class="space-y-4">
            <template v-if="!otpSent">
              <Input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                :disabled="isLoading"
                @keyup.enter="handleEmailSendCode"
              />
              <Button
                class="w-full"
                @click="handleEmailSendCode"
                :disabled="isLoading || !email"
              >
                {{ isLoading ? "Sending..." : "Send code" }}
              </Button>
            </template>
            <template v-else>
              <p class="text-sm text-muted-foreground">
                Code sent to <span class="font-medium text-foreground">{{ email }}</span>
              </p>
              <Input
                v-model="otpCode"
                type="text"
                placeholder="Enter 6-digit code"
                :disabled="isLoading"
                @keyup.enter="handleEmailVerify"
              />
              <Button
                class="w-full"
                @click="handleEmailVerify"
                :disabled="isLoading || !otpCode"
              >
                {{ isLoading ? "Verifying..." : "Verify" }}
              </Button>
            </template>

            <button
              @click="view = 'main'; otpSent = false; email = ''; otpCode = ''; errorMsg = '';"
              class="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 pt-1"
            >
              <Icon name="lucide:arrow-left" class="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>

          <!-- ══ Wallet View ══ -->
          <div v-else-if="view === 'wallet'" class="space-y-2">
            <button
              @click="handleWallet('injected')"
              :disabled="isLoading"
              class="w-full flex items-center justify-between rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              <div class="flex items-center gap-3">
                <Icon name="lucide:wallet" class="w-4 h-4 text-muted-foreground" />
                <span class="text-sm font-medium">Browser Wallet</span>
              </div>
              <Badge variant="outline" class="text-[10px] text-primary border-primary/40">Detected</Badge>
            </button>

            <button
              @click="handleWallet('walletconnect')"
              :disabled="isLoading"
              class="w-full flex items-center gap-3 rounded-md border border-border px-3 py-2.5 hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              <Icon name="simple-icons:walletconnect" class="w-4 h-4 text-[#3B99FC]" />
              <span class="text-sm font-medium">WalletConnect</span>
            </button>

            <button
              @click="view = 'main'; errorMsg = '';"
              class="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 pt-2"
            >
              <Icon name="lucide:arrow-left" class="w-3.5 h-3.5" />
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
