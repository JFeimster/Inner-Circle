import { useCallback, useEffect, useState } from 'react';

type Invite = { reference_code: string; full_name: string; email: string; status: string; created_at: string };
type Member = { user_id: string; name: string; email: string; role: 'member' | 'admin'; membership_status: string; plan_id: string; bonus_credits: number };

export default function AdminWorkspace({ accessToken }: { accessToken: string }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json',
        ...(init?.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Administrator request failed.');
    return body;
  }, [accessToken]);

  useEffect(() => {
    let active = true;
    Promise.all([request('/api/admin/invitations?status=pending'), request('/api/admin/accounts')])
      .then(([a, b]) => { if (active) { setInvites(a.invitations); setMembers(b.accounts); setError(''); } })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [request, revision]);

  const mutate = async (path: string, method: 'POST' | 'PATCH', body?: object) => {
    setBusy(true);
    setError('');
    try {
      await request(path, { method, headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(body || {}) });
      setRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  const button = 'rounded border border-gold/50 px-3 py-1 text-xs text-gold hover:bg-gold/10 disabled:opacity-40';
  return <section className="mx-auto max-w-5xl space-y-8 px-4 py-8 text-white">
    <header><p className="text-xs uppercase tracking-[0.3em] text-gold">Member operations</p>
      <h1 className="mt-2 text-3xl font-serif">Administrator workspace</h1></header>
    {error && <p role="alert" className="rounded border border-red-400 p-3 text-sm text-red-200">{error}</p>}
    <div><h2 className="mb-3 text-xl font-serif">Pending invitations</h2>
      {invites.length === 0 ? <p className="text-white/60">No pending invitations.</p> :
        <div className="space-y-2">{invites.map(invite => <div key={invite.reference_code} className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 p-3">
          <div><strong>{invite.full_name}</strong><p className="text-xs text-white/60">{invite.email} · {invite.reference_code}</p></div>
          <div className="flex gap-2"><button disabled={busy} className={button} onClick={() => mutate(`/api/admin/invitations/${encodeURIComponent(invite.reference_code)}/approve`, 'POST', { assignedRole: 'member' })}>Approve</button>
            <button disabled={busy} className={button} onClick={() => mutate(`/api/admin/invitations/${encodeURIComponent(invite.reference_code)}/revoke`, 'POST')}>Revoke</button></div>
        </div>)}</div>}
    </div>
    <div><h2 className="mb-3 text-xl font-serif">Members</h2>
      <div className="space-y-2">{members.map(member => <div key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 p-3">
        <div><strong>{member.name}</strong><p className="text-xs text-white/60">{member.email} · {member.role} · {member.membership_status} · {member.plan_id} · {member.bonus_credits} pack credits</p></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label={`Membership status for ${member.name}`} value={member.membership_status} disabled={busy} className="rounded bg-black p-1 text-xs" onChange={e => mutate(`/api/admin/accounts/${member.user_id}/membership`, 'PATCH', { membershipStatus: e.target.value })}>
            <option value="active">Active</option><option value="suspended">Suspended</option><option value="revoked">Revoked</option>
          </select>
          <select aria-label={`Plan for ${member.name}`} value={member.plan_id} disabled={busy} className="rounded bg-black p-1 text-xs" onChange={e => mutate(`/api/admin/accounts/${member.user_id}/billing`, 'POST', { planId: e.target.value })}>
            <option value="onboarding">Onboarding</option><option value="producer">Producer</option><option value="inner_circle">Inner Circle</option>
          </select>
          <button disabled={busy} className={button} onClick={() => mutate(`/api/admin/accounts/${member.user_id}/billing`, 'POST', { topupId: 'pack_100' })}>+100 credits</button>
          <button disabled={busy} className={button} onClick={() => mutate(`/api/admin/accounts/${member.user_id}/billing`, 'POST', { topupId: 'pack_300' })}>+300 credits</button>
        </div>
      </div>)}</div>
    </div>
  </section>;
}
