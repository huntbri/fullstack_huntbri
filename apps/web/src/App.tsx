import { FormEvent, useMemo, useState } from "react";

type AuthMode = "signup" | "login";
type UserRole = "admin" | "member";

type CommunityClass = {
  id: string;
  title: string;
  description: string;
  instructor_name: string;
  location: string;
  starts_at: string;
  capacity: number;
  created_at: string;
  created_by: string;
  canEdit?: boolean; // add this if you use canEdit
  canViewRegistrations?: boolean; // add this for the button
};

type MemberClass = CommunityClass & {
  registrationCount: number;
  isRegistered: boolean;
};

type AuthResponse = {
  error?: string;
  message?: string;
  accessToken?: string | null;
  role?: UserRole;
};

const envApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
const apiBaseUrl = (envApiBaseUrl || "http://localhost:4000").replace(/\/$/, "");

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`;
}

async function parseApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  const body = await response.text();
  if (body.trimStart().startsWith("<!DOCTYPE")) {
    throw new Error(
      "Received HTML instead of API JSON. Verify VITE_API_BASE_URL (no trailing slash) and that the API is reachable."
    );
  }

  throw new Error(`Unexpected response from API (${response.status}).`);
}

function roleTitle(role: UserRole) {
  return role === "admin" ? "Admin" : "Member";
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [status, setStatus] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [classesLoading, setClassesLoading] = useState(false);
  const [adminClasses, setAdminClasses] = useState<CommunityClass[]>([]);
  const [memberClasses, setMemberClasses] = useState<MemberClass[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [createLoading, setCreateLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Record<string, any[]>>({});
  const [loadingRegistrations, setLoadingRegistrations] = useState<Record<string, boolean>>({});

  const [registeringClassId, setRegisteringClassId] = useState<string | null>(null);

  // Groq chat state
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");

  async function handleGroqChatSend(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setChatError("");
  if (!chatInput.trim()) return;
  const userMessage = { role: "user", content: chatInput };
  setChatMessages((prev) => [...prev, userMessage]);
  setChatInput("");
  setChatLoading(true);
  try {
    // Call your backend API, not Groq directly
    const response = await fetch(apiUrl("/api/groq"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: userMessage.content })
    });
    if (!response.ok) throw new Error("Groq API error");
    const data = await response.json();
    const groqReply = data.answer || "(No reply)";
    setChatMessages((prev) => [...prev, { role: "groq", content: groqReply }]);
  } catch (err) {
    setChatError("Could not reach Groq chat.");
  } finally {
    setChatLoading(false);
  }
}

  const dashboardTitle = useMemo(() => {
    if (!currentRole) {
      return "Community Classes";
    }
    return `${roleTitle(currentRole)} Dashboard`;
  }, [currentRole]);

  async function loadAdminClasses(token: string) {
    setClassesLoading(true);
    try {
      const response = await fetch(apiUrl("/api/admin/classes"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await parseApiJson<CommunityClass[] | AuthResponse>(response);
      if (!response.ok) {
        const errorData = data as AuthResponse;
        throw new Error(errorData.error ?? "Could not load classes.");
      }

      setAdminClasses(data as CommunityClass[]);
    } finally {
      setClassesLoading(false);
    }
  }

  async function loadMemberClasses(token: string) {
    setClassesLoading(true);
    try {
      const response = await fetch(apiUrl("/api/member/classes"), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await parseApiJson<MemberClass[] | AuthResponse>(response);
      if (!response.ok) {
        const errorData = data as AuthResponse;
        throw new Error(errorData.error ?? "Could not load classes.");
      }
      console.log("[loadMemberClasses] API returned:", data);

      setMemberClasses(data as MemberClass[]);
    } finally {
      setClassesLoading(false);
    }
  }

  async function loadDashboard(role: UserRole, token: string) {
    if (role === "admin") {
      await loadAdminClasses(token);
      return;
    }

    await loadMemberClasses(token);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthLoading(true);
    setStatus("");

    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = { email, password };

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await parseApiJson<AuthResponse>(response);

      if (!response.ok) {
        setStatus(data.error ?? "Authentication failed.");
        return;
      }

      if (!data.accessToken) {
        setStatus(
          data.message ??
            "Account created. Confirm your email in Supabase settings before logging in."
        );
        return;
      }

      if (!data.role) {
        setStatus("Role was not returned by the API.");
        return;
      }

      setAccessToken(data.accessToken);
      setCurrentRole(data.role);
      // Only show status if not 'Login successful'
      if (data.message && data.message !== "Login successful") {
        setStatus(data.message);
      } else {
        setStatus("");
      }
await loadDashboard(data.role, data.accessToken);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
        return;
      }
      setStatus("Could not reach the backend API.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || currentRole !== "admin") {
      setStatus("Only admins can create classes.");
      return;
    }

    const capacityValue = Number(capacity);
    if (!Number.isInteger(capacityValue) || capacityValue <= 0) {
      setStatus("Capacity must be a positive number.");
      return;
    }

    const startsAtMs = Date.parse(startsAt);
    if (Number.isNaN(startsAtMs)) {
      setStatus("Start time must be a valid date and time.");
      return;
    }
    const startsAtIso = new Date(startsAtMs).toISOString();

    setCreateLoading(true);
    setStatus("");

    try {
      const response = await fetch(apiUrl("/api/admin/classes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title,
          description,
          instructorName,
          location,
          startsAt: startsAtIso,
          capacity: capacityValue
        })
      });

      const data = await parseApiJson<AuthResponse>(response);
      if (!response.ok) {
        setStatus(data.error ?? "Class creation failed.");
        return;
      }

      setStatus("Class created.");
      setTitle("");
      setDescription("");
      setInstructorName("");
      setLocation("");
      setStartsAt("");
      setCapacity("20");
      await loadAdminClasses(accessToken);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
        return;
      }
      setStatus("Could not create class.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleViewRegistrations(classId: string) {
  if (!accessToken) return;
  setLoadingRegistrations((prev) => ({ ...prev, [classId]: true }));
  try {
    const response = await fetch(apiUrl(`/api/admin/classes/${classId}/registrations`), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await parseApiJson<any[]>(response);
    setRegistrations((prev) => ({ ...prev, [classId]: data }));
  } catch (err) {
    setRegistrations((prev) => ({ ...prev, [classId]: [{ id: 'error', member_id: 'Error loading registrations' }] }));
  } finally {
    setLoadingRegistrations((prev) => ({ ...prev, [classId]: false }));
  }
}

  async function handleRegister(classId: string) {
    if (!accessToken || currentRole !== "member") {
      setStatus("Only members can register for classes.");
      return;
    }

    setRegisteringClassId(classId);
    setStatus("");

    try {
      const response = await fetch(apiUrl("/api/member/registrations"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ classId })
      });

      const data = await parseApiJson<AuthResponse>(response);
      if (!response.ok) {
        setStatus(data.error ?? "Registration failed.");
        return;
      }

      setStatus(data.message ?? "Registration successful.");
      await loadMemberClasses(accessToken);
    } catch (error) {
      if (error instanceof Error) {
        setStatus(error.message);
        return;
      }
      setStatus("Could not complete registration.");
    } finally {
      setRegisteringClassId(null);
    }
  }

  async function handleUnregister(classId: string) {
  if (!accessToken || currentRole !== "member") {
    setStatus("Only members can unregister from classes.");
    return;
  }

  setRegisteringClassId(classId);
  setStatus("");

  try {
    const response = await fetch(apiUrl("/api/member/registrations"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ classId })
    });

    const data = await parseApiJson<AuthResponse>(response);
    if (!response.ok) {
      setStatus(data.error ?? "Unregistration failed.");
      return;
    }

    setStatus(data.message ?? "Unregistered successfully.");
    await loadMemberClasses(accessToken);
  } catch (error) {
    if (error instanceof Error) {
      setStatus(error.message);
      return;
    }
    setStatus("Could not complete unregistration.");
  } finally {
    setRegisteringClassId(null);
  }
}

  function logout() {
    setAccessToken(null);
    setCurrentRole(null);
    setAdminClasses([]);
    setMemberClasses([]);
    setStatus("Logged out.");
  }

  return (
    <main className="page">
      <section className="panel">
        {accessToken && (
  <section className="stack chat-section">
    <h2>Chat with Groq</h2>
    <div className="chat-box" style={{border: '1px solid #ccc', borderRadius: 8, padding: 16, maxHeight: 300, overflowY: 'auto', background: '#fafbfc', marginBottom: 8}}>
      {chatMessages.length === 0 ? (
        <p style={{color: '#888'}}>No messages yet. Say hello!</p>
      ) : (
        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
          {chatMessages.map((msg, idx) => (
            <li key={idx} style={{marginBottom: 8, textAlign: msg.role === 'user' ? 'right' : 'left'}}>
              <span style={{fontWeight: msg.role === 'user' ? 'bold' : 'normal'}}>{msg.role === 'user' ? 'You' : 'Groq'}: </span>
              <span>{msg.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
    <form onSubmit={handleGroqChatSend} style={{display: 'flex', gap: 8}}>
      <input
        type="text"
        placeholder="Type your message..."
        value={chatInput}
        onChange={e => setChatInput(e.target.value)}
        disabled={chatLoading}
        style={{flex: 1}}
        required
      />
      <button type="submit" disabled={chatLoading || !chatInput.trim()}>
        {chatLoading ? 'Sending...' : 'Send'}
      </button>
    </form>
    {chatError && <p className="status" style={{color: 'red'}}>{chatError}</p>}
  </section>
)}
        <header className="panel-header">
          <div>
            <h1>{dashboardTitle}</h1>
            <p>Local programs for neighbors, families, and lifelong learners.</p>
          </div>
          {accessToken && (
            <button type="button" className="ghost" onClick={logout}>
              Log Out
            </button>
          )}
        </header>

        {!accessToken ? (
          <form onSubmit={handleAuthSubmit} className="stack">
            <div className="toggle-row">
              <button
                type="button"
                className={authMode === "signup" ? "active" : ""}
                onClick={() => setAuthMode("signup")}
              >
                Sign Up
              </button>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Log In
              </button>
            </div>

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password (8+ characters)"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <button type="submit" disabled={authLoading}>
              {authLoading
                ? "Please wait..."
                : authMode === "signup"
                  ? "Create Member Account"
                  : "Log In"}
            </button>
          </form>
        ) : currentRole === "admin" ? (
          <>
            <form onSubmit={handleCreateClass} className="stack">
              <h2>Create a Class</h2>
              <input
                type="text"
                placeholder="Class title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
              <textarea
                placeholder="Class description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                required
              />
              <input
                type="text"
                placeholder="Instructor name"
                value={instructorName}
                onChange={(event) => setInstructorName(event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
              />
              <div className="split">
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  required
                />
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={createLoading}>
                {createLoading ? "Saving..." : "Add Class"}
              </button>
            </form>

            <section className="stack">
              <h2>All Classes</h2>
              {classesLoading ? (
                <p>Loading classes...</p>
              ) : adminClasses.length === 0 ? (
                <p>No classes yet.</p>
              ) : (
                <ul className="class-list">
                  {adminClasses.map((item) => (
                    <li key={item.id} className="class-card">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <p>
                        <strong>Instructor:</strong> {item.instructor_name}
                      </p>
                      <p>
                        <strong>Location:</strong> {item.location}
                      </p>
                      <p>
                        <strong>Starts:</strong> {new Date(item.starts_at).toLocaleString()}
                      </p>
                      <p>
                        <strong>Capacity:</strong> {item.capacity}
                      </p>
                      {('canViewRegistrations' in item) && item.canViewRegistrations && (
                      <button type="button" onClick={() => handleViewRegistrations(item.id)}>
                        View Registrations
                      </button>
                    )}
                    {loadingRegistrations[item.id] && <div>Loading registrations...</div>}
                    {registrations[item.id] && (
                      <ul style={{ marginTop: 8 }}>
                        {registrations[item.id].length === 0 ? (
                          <li>No registrations yet.</li>
                        ) : (
                          registrations[item.id].map((reg) => (
                            <li key={reg.id}>Member ID: {reg.member_id}</li>
                          ))
                        )}
                      </ul>
                    )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <section className="stack">
            <h2>Available Classes</h2>
            {classesLoading ? (
              <p>Loading classes...</p>
            ) : memberClasses.length === 0 ? (
              <p>No classes are available yet.</p>
            ) : (
              <ul className="class-list">
                {memberClasses.map((item) => {
                  const isFull = item.registrationCount >= item.capacity;
                  return (
                    <li key={item.id} className="class-card">
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <p>
                        <strong>Instructor:</strong> {item.instructor_name}
                      </p>
                      <p>
                        <strong>Location:</strong> {item.location}
                      </p>
                      <p>
                        <strong>Starts:</strong> {new Date(item.starts_at).toLocaleString()}
                      </p>
                      <p>
                        <strong>Registered:</strong> {item.registrationCount}/{item.capacity}
                      </p>
                      {item.isRegistered ? (
  <button
    type="button"
    disabled={registeringClassId === item.id}
    onClick={() => handleUnregister(item.id)}
  >
    {registeringClassId === item.id ? "Unregistering..." : "Unregister"}
  </button>
) : (
  <button
    type="button"
    disabled={isFull || registeringClassId === item.id}
    onClick={() => handleRegister(item.id)}
  >
    {isFull
      ? "Class Full"
      : registeringClassId === item.id
        ? "Registering..."
        : "Register"}
  </button>
)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {status && <p className="status">{status}</p>}

        {/* Groq Chat Section */}

      </section>
    </main>
  );
}
