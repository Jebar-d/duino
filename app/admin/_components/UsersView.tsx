import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import type { AdminUser, User } from "./types";
import { escapeText } from "./utils";
import { StatusBadge } from "./StatusBadge";

export function UsersView({
  showToast,
  currentUserId,
}: {
  showToast: (message: string, type?: string) => void;
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [nameForm, setNameForm] = useState({ first_name: "", last_name: "", contact_number: "" });
  const [notifying, setNotifying] = useState<AdminUser | null>(null);
  const [notificationForm, setNotificationForm] = useState({ title: "", message: "" });
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setError("");
      const data = await apiFetch<{ success: boolean; users: AdminUser[] }>("/admin/users.php");
      setUsers(data.users ?? []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load users.";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoadingUsers(false);
    }
  }, [showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadUsers(), 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function updateUser(payload: Record<string, unknown>, successMessage: string) {
    try {
      setSaving(true);
      await apiFetch("/admin/users.php", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      showToast(successMessage, "success");
      await loadUsers();
      setEditing(null);
    } catch (updateError) {
      showToast(updateError instanceof Error ? updateError.message : "Unable to update user.", "error");
    } finally {
      setSaving(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value.replace(" ", "T")).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <>
      <div className="adm-ph">
        <div>
          <div className="adm-ph-title">Users</div>
          <div className="adm-ph-sub">View registered customer and administrator accounts.</div>
        </div>
      </div>

      <div className="adm-tw">
        <table className="adm-t">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Email Verification</th>
              <th>Disabled</th>
              <th>Orders</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? (
              <tr><td colSpan={7}><div className="adm-empty">Loading users...</div></td></tr>
            ) : error ? (
              <tr><td colSpan={7}><div className="adm-empty">{error}</div></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7}><div className="adm-empty">No users found.</div></td></tr>
            ) : (
              users.map((account) => (
                <tr key={account.id}>
                  <td>{account.email}</td>
                  <td><StatusBadge status={account.role} /></td>
                  <td><StatusBadge status={account.email_verified ? "Verified" : "Not Verified"} /></td>
                  <td><StatusBadge status={account.is_disabled ? "Disabled" : "Enabled"} /></td>
                  <td>{account.order_count}</td>
                  <td className="adm-muted adm-small">{formatDate(account.created_at)}</td>
                  <td>
                    <div className="adm-actions">
                      <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => {
                        setEditing(account);
                        setNameForm({ first_name: account.first_name || "", last_name: account.last_name || "", contact_number: account.contact_number || "" });
                      }}>Edit</button>
                      {account.id !== currentUserId && (
                        <>
                          <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => {
                            const role = account.role === "admin" ? "user" : "admin";
                            if (window.confirm(`${role === "admin" ? "Make" : "Remove"} ${account.email} ${role === "admin" ? "an admin" : "admin access"}?`)) {
                              void updateUser({ action: "set_role", user_id: account.id, role }, "User role updated.");
                            }
                          }}>{account.role === "admin" ? "Remove admin" : "Make admin"}</button>
                          <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => {
                            const disabled = !account.is_disabled;
                            if (window.confirm(`${disabled ? "Disable" : "Enable"} ${account.email}?`)) {
                              void updateUser({ action: "set_disabled", user_id: account.id, disabled }, `User ${disabled ? "disabled" : "enabled"}.`);
                            }
                          }}>{account.is_disabled ? "Enable" : "Disable"}</button>
                        </>
                      )}
                      <button type="button" className="adm-btn adm-btn-o adm-btn-s" onClick={() => {
                        setNotifying(account);
                        setNotificationForm({ title: "", message: "" });
                      }}>Send notification</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Edit user">
          <div className="adm-modal-box">
            <div className="adm-mh"><div className="adm-mt">Edit user</div><button type="button" className="adm-mx" onClick={() => setEditing(null)}>×</button></div>
            <div className="fg"><label>First name</label><input value={nameForm.first_name} onChange={(event) => setNameForm({ ...nameForm, first_name: event.target.value })} /></div>
            <div className="fg"><label>Last name</label><input value={nameForm.last_name} onChange={(event) => setNameForm({ ...nameForm, last_name: event.target.value })} /></div>
            <div className="fg"><label>Contact number</label><input value={nameForm.contact_number} onChange={(event) => setNameForm({ ...nameForm, contact_number: event.target.value })} /></div>
            <div className="adm-mf">
              <button type="button" className="adm-btn adm-btn-o" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="adm-btn adm-btn-p" disabled={saving} onClick={() => void updateUser({ action: "update", user_id: editing.id, ...nameForm }, "User profile updated.")}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
      {notifying && (
        <div className="adm-modal" role="dialog" aria-modal="true" aria-label="Send notification">
          <div className="adm-modal-box">
            <div className="adm-mh"><div className="adm-mt">Send notification</div><button type="button" className="adm-mx" onClick={() => setNotifying(null)}>×</button></div>
            <p className="adm-muted adm-small">To: {notifying.email}</p>
            <div className="fg"><label>Title</label><input value={notificationForm.title} onChange={(event) => setNotificationForm({ ...notificationForm, title: event.target.value })} /></div>
            <div className="fg"><label>Message</label><textarea value={notificationForm.message} onChange={(event) => setNotificationForm({ ...notificationForm, message: event.target.value })} /></div>
            <div className="adm-mf">
              <button type="button" className="adm-btn adm-btn-o" onClick={() => setNotifying(null)}>Cancel</button>
              <button type="button" className="adm-btn adm-btn-p" disabled={saving || !notificationForm.title.trim() || !notificationForm.message.trim()} onClick={async () => {
                try {
                  setSaving(true);
                  await apiFetch("/admin/notify.php", { method: "POST", body: JSON.stringify({ ...notificationForm, user_id: notifying.id }) });
                  showToast("Notification sent.", "success");
                  setNotifying(null);
                } catch (notifyError) {
                  showToast(notifyError instanceof Error ? notifyError.message : "Unable to send notification.", "error");
                } finally {
                  setSaving(false);
                }
              }}>{saving ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
