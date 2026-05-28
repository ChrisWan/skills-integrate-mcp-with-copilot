document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const createActivityForm = document.getElementById("create-activity-form");
  const userStatus = document.getElementById("user-status");
  const statusText = document.getElementById("status-text");
  const accountActions = document.getElementById("account-actions");
  const logoutButton = document.getElementById("logout-button");
  const authForms = document.getElementById("auth-forms");
  const adminActions = document.getElementById("admin-actions");
  const messageDiv = document.getElementById("message");

  let authToken = localStorage.getItem("mhs-token");
  let currentUser = JSON.parse(localStorage.getItem("mhs-user") || "null");

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setSession(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem("mhs-token", token);
    localStorage.setItem("mhs-user", JSON.stringify(user));
    renderAuthState();
  }

  function clearSession() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem("mhs-token");
    localStorage.removeItem("mhs-user");
    renderAuthState();
  }

  function renderAuthState() {
    if (currentUser) {
      authForms.classList.add("hidden");
      accountActions.classList.remove("hidden");
      userStatus.classList.remove("hidden");
      userStatus.textContent = `Signed in as ${currentUser.username} (${currentUser.role})`;
      statusText.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
      if (currentUser.role === "admin") {
        adminActions.classList.remove("hidden");
      } else {
        adminActions.classList.add("hidden");
      }
    } else {
      authForms.classList.remove("hidden");
      accountActions.classList.add("hidden");
      adminActions.classList.add("hidden");
      userStatus.classList.add("hidden");
      userStatus.textContent = "";
      statusText.textContent = "";
    }
  }

  async function fetchSession() {
    if (!authToken) {
      clearSession();
      return;
    }

    try {
      const response = await fetch("/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        clearSession();
        return;
      }

      const result = await response.json();
      setSession(authToken, result);
    } catch (error) {
      console.error("Error validating session:", error);
      clearSession();
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const isParticipant = currentUser && details.participants.includes(currentUser.email);
        const isFull = details.participants.length >= details.max_participants;

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
                <h5>Participants:</h5>
                <ul class="participants-list">
                  ${details.participants
                    .map((email) => `<li><span class="participant-email">${email}</span></li>`)
                    .join("")}
                </ul>
              </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
          <div class="activity-actions"></div>
        `;

        const actions = activityCard.querySelector(".activity-actions");

        if (currentUser && currentUser.role === "student") {
          if (isParticipant) {
            actions.innerHTML = `<button class="unregister-btn" data-activity="${name}">Unregister</button>`;
          } else if (!isFull) {
            actions.innerHTML = `<button class="signup-btn" data-activity="${name}">Sign Up</button>`;
          } else {
            actions.innerHTML = `<span class="info">Full</span>`;
          }
        }

        if (currentUser && currentUser.role === "admin") {
          const adminButtons = document.createElement("div");
          adminButtons.className = "activity-actions";
          adminButtons.innerHTML = `
            <button class="delete-activity-btn" data-activity="${name}">Delete Activity</button>
          `;
          actions.replaceWith(adminButtons);
        }

        activitiesList.appendChild(activityCard);
      });

      attachActivityListeners();
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  function attachActivityListeners() {
    document.querySelectorAll(".signup-btn").forEach((button) => {
      button.addEventListener("click", handleSignUp);
    });
    document.querySelectorAll(".unregister-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
    document.querySelectorAll(".delete-activity-btn").forEach((button) => {
      button.addEventListener("click", handleDeleteActivity);
    });
  }

  async function handleSignUp(event) {
    const activity = event.target.getAttribute("data-activity");

    if (!authToken) {
      showMessage("Please log in to sign up for activities.", "error");
      return;
    }

    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}/signup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }

      fetchActivities();
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  }

  async function handleUnregister(event) {
    const activity = event.target.getAttribute("data-activity");

    if (!authToken) {
      showMessage("Please log in to unregister from activities.", "error");
      return;
    }

    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}/unregister`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }

      fetchActivities();
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleDeleteActivity(event) {
    const activity = event.target.getAttribute("data-activity");

    if (!authToken) {
      showMessage("Please log in as an admin to delete activities.", "error");
      return;
    }

    try {
      const response = await fetch(`/activities/${encodeURIComponent(activity)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }

      fetchActivities();
    } catch (error) {
      showMessage("Failed to delete activity. Please try again.", "error");
      console.error("Error deleting activity:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    if (!username || !password) {
      showMessage("Username and password are required.", "error");
      return;
    }

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (response.ok) {
        setSession(result.token, result.user);
        showMessage("Logged in successfully.", "success");
        fetchActivities();
      } else {
        showMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value.trim();
    const role = document.getElementById("register-role").value;

    if (!username || !email || !password || !role) {
      showMessage("All registration fields are required.", "error");
      return;
    }

    try {
      const response = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, role }),
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        registerForm.reset();
      } else {
        showMessage(result.detail || "Registration failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to register. Please try again.", "error");
      console.error("Error registering:", error);
    }
  });

  createActivityForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("activity-name").value.trim();
    const description = document.getElementById("activity-description").value.trim();
    const schedule = document.getElementById("activity-schedule").value.trim();
    const maxParticipants = Number(document.getElementById("activity-max").value);

    if (!name || !description || !schedule || !maxParticipants) {
      showMessage("All activity fields are required.", "error");
      return;
    }

    try {
      const response = await fetch(`/activities/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ description, schedule, max_participants: maxParticipants }),
      });

      const result = await response.json();
      if (response.ok) {
        showMessage(result.message, "success");
        createActivityForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "Activity creation failed.", "error");
      }
    } catch (error) {
      showMessage("Failed to create activity. Please try again.", "error");
      console.error("Error creating activity:", error);
    }
  });

  logoutButton.addEventListener("click", () => {
    clearSession();
    showMessage("Logged out successfully.", "info");
    fetchActivities();
  });

  renderAuthState();
  fetchSession().then(fetchActivities);
});
