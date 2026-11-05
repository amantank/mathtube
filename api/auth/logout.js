import { setCookie } from "../_lib.js";

export default function logout(req, res) {
  setCookie(res, "mt_session", "", 0);
  res.redirect(302, "/#/");
}
