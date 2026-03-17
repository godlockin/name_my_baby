export async function generateName(data: any) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Generation failed");
  }

  return response.json();
}

export async function getJobStatus(sessionId: string) {
  const response = await fetch(`/api/job/${sessionId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch job status");
  }

  return response.json();
}

export async function verifyInviteCode(code: string) {
  const response = await fetch("/api/invite/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  return response.json();
}

export async function getHistory(deviceId: string) {
  const response = await fetch(`/api/history?deviceId=${deviceId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch history");
  }

  return response.json();
}
