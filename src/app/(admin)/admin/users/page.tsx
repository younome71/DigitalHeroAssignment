import { createClient } from '@/lib/supabase/server';
import { UserRoleToggle } from './UserRoleToggle';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: users } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, company_name, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  const list = users ?? [];

  return (
    <div>
      <p className="spec-label">Users</p>
      <h1 className="mt-1 font-display text-display-md">Accounts.</h1>

      <div className="mt-6 overflow-x-auto rounded-sm border border-line bg-surface">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line bg-canvas text-left">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Company</Th>
              <Th>Role</Th>
              <Th>Joined</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">
                  No users.
                </td>
              </tr>
            ) : (
              list.map((u) => (
                <tr key={u.id} className="border-b border-line/60 last:border-0">
                  <Td>{u.full_name || '—'}</Td>
                  <Td className="font-mono text-[11px]">{u.email}</Td>
                  <Td>{u.company_name || '—'}</Td>
                  <Td>
                    <span className="tag capitalize">{u.role}</span>
                  </Td>
                  <Td className="text-[10px] text-ink-muted">
                    {new Date(u.created_at).toLocaleDateString('en-NZ')}
                  </Td>
                  <Td>
                    <UserRoleToggle
                      userId={u.id}
                      currentRole={u.role as 'customer' | 'admin'}
                    />
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className ?? ''}`}>{children}</td>;
}