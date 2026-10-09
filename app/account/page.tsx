import { redirect } from "next/navigation";

// The header and sidebar link to /account, which used to be a 404.
export default function AccountIndex() {
  redirect("/account/profile");
}
