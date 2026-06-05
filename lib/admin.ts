/** The exchange operator. Only these accounts can list events and set settlements. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const admins = (process.env.ADMIN_EMAILS || "william.grannis@transmarketgroup.com")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return !!email && admins.includes(email.toLowerCase());
}
