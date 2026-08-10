"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type AuthStep = "login" | "login_mfa" | "signup_creds" | "signup_otp" | "signup_details" | "forgot_email" | "forgot_otp" | "forgot_new_password";

export default function LoginPage() {
  const [step, setStep] = useState<AuthStep>("login");
  
  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? systemTheme : theme;
  const logoSrc = mounted && currentTheme === "dark" ? "/logo-black.png" : "/logo-white.png";
  
  const supabase = createClient();
  const router = useRouter();

  const resetMessages = () => {
    setError(null);
    setMessage(null);
  };

  // 1. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const mfaStatus = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaStatus.data?.nextLevel === 'aal2' && mfaStatus.data?.currentLevel !== 'aal2') {
        setOtp(""); 
        setStep("login_mfa");
        setLoading(false);
      } else {
        window.location.href = "/";
      }
    }
  };

  const handleVerifyLoginMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); resetMessages();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totpFactor = factors?.totp?.[0];
    if (!totpFactor) {
      setError("No 2FA device found on this account.");
      setLoading(false);
      return;
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
    if (challenge.error) {
      setError(challenge.error.message);
      setLoading(false);
      return;
    }
    const verify = await supabase.auth.mfa.verify({ factorId: totpFactor.id, challengeId: challenge.data.id, code: otp });
    if (verify.error) {
      setError("Invalid 2FA code. Please try again.");
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  // 2. Handle Step 1 of Signup (Send OTP)
  const handleSignUpStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes("rate limit")) {
        setError("Supabase free-tier email limit reached. Please configure a custom SMTP (like Resend) in Supabase dashboard to send more emails.");
      } else {
        setError(error.message);
      }
    } else {
      setMessage(`We sent a verification code to ${email}`);
      setStep("signup_otp");
    }
    setLoading(false);
  };

  // 3. Handle Step 2 of Signup (Verify OTP)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup"
    });
    
    if (error) {
      setError("Invalid OTP. Please try again.");
    } else {
      setMessage("Email verified! Just a few more details.");
      setStep("signup_details");
    }
    setLoading(false);
  };

  // 4. Handle Step 3 of Signup (Save Details)
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    resetMessages();
    
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name, dob: dob, mobile: mobile }
    });
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  // 5. Handle Forgot Password (Send Recovery OTP)
  const handleForgotStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); resetMessages();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) setError(error.message);
      else { setMessage(`Recovery code sent to ${email}`); setStep("forgot_otp"); }
    } catch (err: any) {
      setError(err.message || "Network timeout. Try again.");
    }
    setLoading(false);
  };

  // 6. Handle Forgot Password (Verify OTP)
  const handleForgotVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); resetMessages();
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
    if (error) setError("Invalid code. Please try again.");
    else { setMessage("Code verified. Please enter your new password."); setStep("forgot_new_password"); }
    setLoading(false);
  };

  // 7. Handle Forgot Password (Update Password)
  const handleForgotComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); resetMessages();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else { setMessage("Password updated successfully! You can now log in."); setStep("login"); }
    setLoading(false);
  };

  const renderForm = () => {
    switch (step) {
      case "login":
        return (
          <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium opacity-80">Password</label>
                <button type="button" onClick={() => { setStep("forgot_email"); resetMessages(); }} className="text-[13px] text-blue-500 font-medium hover:underline focus:outline-none">Forgot password?</button>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-text-main text-bg-main font-semibold py-3.5 rounded-[16px] hover:opacity-90 transition-opacity disabled:opacity-50 text-[15px]">
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <span className="opacity-60">Don't have an account? </span>
              <button type="button" onClick={() => { setStep("signup_creds"); resetMessages(); }} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Create account</button>
            </div>
          </motion.form>
        );

      case "login_mfa":
        return (
          <motion.form key="login_mfa" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerifyLoginMfa} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80 text-center">Authenticator Code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit code" maxLength={6} className="w-full text-center tracking-[0.5em] text-2xl font-bold bg-bg-main border border-border-main rounded-[16px] px-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50 text-[15px]">
                {loading ? "Verifying..." : "Secure Sign In"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <button type="button" onClick={() => { setStep("login"); supabase.auth.signOut(); }} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Cancel</button>
            </div>
          </motion.form>
        );

      case "signup_creds":
        return (
          <motion.form key="signup_creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleSignUpStart} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Create Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-text-main text-bg-main font-semibold py-3.5 rounded-[16px] hover:opacity-90 transition-opacity disabled:opacity-50 text-[15px]">
                {loading ? "Sending OTP..." : "Continue"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <span className="opacity-60">Already have an account? </span>
              <button type="button" onClick={() => { setStep("login"); resetMessages(); }} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Sign in</button>
            </div>
          </motion.form>
        );

      case "signup_otp":
        return (
          <motion.form key="signup_otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80 text-center">Enter the verification code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter code" className="w-full text-center tracking-[0.5em] text-2xl font-bold bg-bg-main border border-border-main rounded-[16px] px-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50 text-[15px]">
                {loading ? "Verifying..." : "Verify Email"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <button type="button" onClick={() => setStep("signup_creds")} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Back to Email</button>
            </div>
          </motion.form>
        );

      case "signup_details":
        return (
          <motion.form key="signup_details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleSaveDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Date of Birth</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Mobile Number (Optional)</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+1 234 567 8900" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" />
            </div>
            <div className="pt-4">
              <button type="submit" disabled={loading} className="w-full bg-text-main text-bg-main font-semibold py-3.5 rounded-[16px] hover:opacity-90 transition-opacity disabled:opacity-50 text-[15px]">
                {loading ? "Completing setup..." : "Enter DuoMind"}
              </button>
            </div>
          </motion.form>
        );

      case "forgot_email":
        return (
          <motion.form key="forgot_email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleForgotStart} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Enter your email address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-text-main text-bg-main font-semibold py-3.5 rounded-[16px] hover:opacity-90 transition-opacity disabled:opacity-50 text-[15px]">
                {loading ? "Sending Code..." : "Send Recovery Code"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <button type="button" onClick={() => { setStep("login"); resetMessages(); }} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Back to Sign in</button>
            </div>
          </motion.form>
        );

      case "forgot_otp":
        return (
          <motion.form key="forgot_otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleForgotVerify} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80 text-center">Enter the recovery code</label>
              <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter code" className="w-full text-center tracking-[0.5em] text-2xl font-bold bg-bg-main border border-border-main rounded-[16px] px-4 py-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50 text-[15px]">
                {loading ? "Verifying..." : "Verify Code"}
              </button>
            </div>
            <div className="mt-8 text-center text-[14px]">
              <button type="button" onClick={() => setStep("forgot_email")} disabled={loading} className="text-blue-500 font-semibold hover:underline focus:outline-none">Back</button>
            </div>
          </motion.form>
        );

      case "forgot_new_password":
        return (
          <motion.form key="forgot_new_password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleForgotComplete} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 opacity-80">Enter a New Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} className="w-full bg-bg-main border border-border-main rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:opacity-40" required />
            </div>
            <div className="pt-3">
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-[16px] hover:bg-blue-700 transition-colors disabled:opacity-50 text-[15px]">
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </motion.form>
        );
    }
  };

  return (
    <div className="flex h-screen bg-bg-main items-center justify-center font-sans text-text-main transition-colors duration-300 px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-[28px] bg-bg-sidebar border border-border-main shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-4 overflow-hidden rounded-[16px] flex items-center justify-center">
             <Image src={logoSrc} alt="DuoMind" width={64} height={64} className="object-contain scale-[1.15]" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mt-2 text-center">
            {step === "login" && <>Sign in to <span className="text-text-main">Duo</span><span className="text-blue-600">Mind</span></>}
            {step === "login_mfa" && "Two-Factor Auth"}
            {step === "signup_creds" && "Create an account"}
            {step === "signup_otp" && "Check your email"}
            {step === "signup_details" && "Personalize your profile"}
            {step === "forgot_email" && "Reset Password"}
            {step === "forgot_otp" && "Check your email"}
            {step === "forgot_new_password" && "Secure your account"}
          </h2>
          <p className="text-[15px] opacity-60 mt-2 text-center">
            {step === "login" && "Welcome back! Please enter your details."}
            {step === "login_mfa" && "Open your authenticator app to get the code."}
            {step === "signup_creds" && "Enter your email and a strong password."}
            {step === "signup_otp" && "We sent an OTP. Please check your spam folder too."}
            {step === "signup_details" && "Tell us a little bit about yourself."}
            {step === "forgot_email" && "Enter your email to receive a recovery code."}
            {step === "forgot_otp" && "We sent a recovery code to your email."}
            {step === "forgot_new_password" && "Enter your new strong password below."}
          </p>
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
             {renderForm()}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="text-red-500 text-sm text-center bg-red-500/10 py-3 rounded-[12px] font-medium mt-6">
              {error}
            </motion.div>
          )}
          {message && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="text-green-500 text-[13.5px] text-center bg-green-500/10 py-3 px-4 rounded-[12px] font-medium mt-6 leading-relaxed">
              {message}
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
