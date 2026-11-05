import crypto from "node:crypto";
import { origin, setCookie } from "../_lib.js";

export default function login(req, res) {
  const state = crypto.randomBytes(16).toString("hex");
  setCookie(res, "mt_state", state, 600);
  const q = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${origin(req)}/api/auth/callback`,
    scope: "read:user",
    state,
  });
  res.redirect(302, `https://github.com/login/oauth/authorize?${q}`);
}
