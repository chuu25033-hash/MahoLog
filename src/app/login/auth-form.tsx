"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AuthForm() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const isSignUp = tab === "signup";
  const state = isSignUp ? signUpState : signInState;
  const pending = isSignUp ? signingUp : signingIn;

  return (
    <Card className="mx-auto w-full max-w-sm gap-5 px-6">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 text-sm">
        {(
          [
            { key: "signin", label: "ログイン" },
            { key: "signup", label: "新規登録" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full py-1.5 tracking-wider transition-all duration-300",
              tab === t.key
                ? "bg-starlight/10 text-starlight ring-1 ring-starlight/45"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form key={tab} action={isSignUp ? signUpAction : signInAction} className="flex flex-col gap-3">
        {isSignUp && (
          <div className="grid gap-1.5">
            <Label htmlFor="username">探究者の名前</Label>
            <Input id="username" name="username" maxLength={30} required />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={6}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
          />
        </div>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        {state.message && <p className="text-xs text-aqua">{state.message}</p>}
        <Button type="submit" size="lg" disabled={pending}>
          {isSignUp ? "秘術探究者として旅立つ" : "ログイン"}
        </Button>
      </form>
    </Card>
  );
}
