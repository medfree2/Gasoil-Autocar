import { useEffect, useMemo, useState } from "react";

import {
  AlertTriangle,
  BarChart3,
  BusFront,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Fuel,
  History,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Landmark,
  LayoutList,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  KeyRound,
  Wallet,
  X,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");

const FILE_URL =
  import.meta.env.VITE_FILE_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : window.location.origin);

const GASOIL_API = `${API_BASE_URL}/api/gasoil`;
const AVANCES_API = `${API_BASE_URL}/api/avances`;
const ACTIVE_AVANCE_API = `${API_BASE_URL}/api/avances/active`;
const AUTH_API = `${API_BASE_URL}/api/auth`;
const CENTRES_API = `${API_BASE_URL}/api/centres`;

const DEFAULT_UNIT_PRICE = 16.37;

const resolveFileUrl = (value) => {
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `${FILE_URL}${value}`;
};

const cloudinaryImageUrl = (
  value,
  {
    width = 320,
    quality = "auto:eco",
  } = {}
) => {
  const url = resolveFileUrl(value);

  if (
    !url ||
    !url.includes("res.cloudinary.com") ||
    !url.includes("/upload/")
  ) {
    return url;
  }

  const transformation = [
    "f_auto",
    `q_${quality}`,
    `w_${width}`,
    "c_limit",
  ].join(",");

  return url.replace(
    "/upload/",
    `/upload/${transformation}/`
  );
};

const todayISO = () => new Date().toISOString().split("T")[0];

const formatMoney = (value) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const auditUserLabel = (
  item,
  prefix
) => {
  if (!item) return "—";

  const matricule =
    item[`${prefix}Matricule`] || "";

  const name =
    item[`${prefix}Name`] || "";

  const email =
    item[`${prefix}Email`] || "";

  if (matricule && name) {
    return `${matricule} — ${name}`;
  }

  return matricule || name || email || "—";
};

const sameDay = (dateA, dateB) => {
  if (!dateA || !dateB) return false;

  return (
    new Date(dateA).toISOString().split("T")[0] ===
    new Date(dateB).toISOString().split("T")[0]
  );
};

function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem("gasoil_auth_token") || ""
  );
  const [setupRequired, setSetupRequired] = useState(false);

  const [page, setPage] = useState("suivi");

  const [records, setRecords] = useState([]);
  const [avances, setAvances] = useState([]);
  const [activeAdvance, setActiveAdvance] = useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingAvances, setLoadingAvances] = useState(true);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [editingRecord, setEditingRecord] = useState(null);

  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [advancePreview, setAdvancePreview] = useState("");

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    matricule: "",
    password: "",
    name: "",
    role: "USER",
    centre: "",
  });
  const [editingUser, setEditingUser] = useState(null);

  const [centres, setCentres] = useState([]);
  const [loadingCentres, setLoadingCentres] = useState(false);
  const [selectedCentreId, setSelectedCentreId] = useState("");
  const [showCentreForm, setShowCentreForm] = useState(false);
  const [savingCentre, setSavingCentre] = useState(false);
  const [editingCentre, setEditingCentre] = useState(null);
  const [centreForm, setCentreForm] = useState({
    name: "",
    code: "",
    active: true,
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [form, setForm] = useState({
    date: todayISO(),
    autocar: "",
    depart: "",
    quantite: "",
    numeroBon: "",
    prixUnitaire: String(DEFAULT_UNIT_PRICE),
    prixTotal: "",
    observation: "",
    imageBon: null,
  });

  const [advanceForm, setAdvanceForm] = useState({
    date: todayISO(),
    montant: "",
    numeroCheque: "",
    station: "",
    banque: "",
    observation: "",
    imageCheque: null,
  });

  const isSuperAdmin =
    authUser?.role === "SUPER_ADMIN";

  const canManageUsers =
    ["ADMIN", "SUPER_ADMIN"].includes(
      authUser?.role
    );

  const activeCentre = useMemo(() => {
    const selected =
      centres.find(
        (centre) =>
          String(centre.id) ===
          String(selectedCentreId)
      );

    if (selected) {
      return selected;
    }

    return authUser?.centre || null;
  }, [
    centres,
    selectedCentreId,
    authUser,
  ]);

  const centreScopedUrl = (url) => {
    if (!selectedCentreId) {
      return url;
    }

    const separator =
      url.includes("?") ? "&" : "?";

    return `${url}${separator}centre=${encodeURIComponent(
      selectedCentreId
    )}`;
  };

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const authFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {}),
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && authToken) {
      localStorage.removeItem("gasoil_auth_token");
      setAuthToken("");
      setAuthUser(null);
    }

    return response;
  };

  const checkAuthentication = async () => {
    try {
      setAuthLoading(true);

      const statusResponse = await fetch(`${AUTH_API}/status`);
      const statusData = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(
          statusData.message ||
            "Impossible de vérifier l'authentification."
        );
      }

      setSetupRequired(Boolean(statusData.setupRequired));

      const storedToken =
        localStorage.getItem("gasoil_auth_token");

      if (!storedToken) {
        setAuthUser(null);
        return;
      }

      const meResponse = await fetch(`${AUTH_API}/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      const meData = await meResponse.json();

      if (!meResponse.ok) {
        localStorage.removeItem("gasoil_auth_token");
        setAuthToken("");
        setAuthUser(null);
        return;
      }

      setAuthToken(storedToken);
      setAuthUser(meData);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthenticated = (user, token) => {
    localStorage.setItem("gasoil_auth_token", token);
    setAuthToken(token);
    setAuthUser(user);
    setSetupRequired(false);
    setMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("gasoil_auth_token");
    setAuthToken("");
    setAuthUser(null);
    setRecords([]);
    setAvances([]);
    setActiveAdvance(null);
    setCentres([]);
    setSelectedCentreId("");
    setUsers([]);
    setPage("suivi");
  };

  const openPasswordForm = () => {
    setPasswordError("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordForm(true);
  };

  const closePasswordForm = () => {
    if (savingPassword) return;

    setShowPasswordForm(false);
    setPasswordError("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;

    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (passwordError) {
      setPasswordError("");
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setPasswordError(
        "Les deux nouveaux mots de passe ne correspondent pas."
      );
      return;
    }

    if (
      String(passwordForm.newPassword).length < 6
    ) {
      setPasswordError(
        "Le nouveau mot de passe doit contenir au moins 6 caractères."
      );
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError("");

      const response = await authFetch(
        `${AUTH_API}/change-password`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            passwordForm
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors de la modification du mot de passe."
        );
      }

      setShowPasswordForm(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      window.alert(
        "Mot de passe modifié avec succès."
      );
    } catch (error) {
      setPasswordError(
        error.message
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // =========================================================
  // MULTI-CENTRE DATA
  // =========================================================

  const loadCentres = async () => {
    try {
      setLoadingCentres(true);

      const response =
        await authFetch(
          CENTRES_API
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors du chargement des centres."
        );
      }

      const normalizedCentres = Array.isArray(data)
        ? data.map((centre) => ({
            ...centre,
            id:
              centre.id ||
              centre._id ||
              "",
            usersCount:
              centre.usersCount ??
              centre.stats?.usersCount ??
              0,
            bonsCount:
              centre.bonsCount ??
              centre.stats?.bonsCount ??
              0,
            litres:
              centre.litres ??
              centre.stats?.litres ??
              0,
            montant:
              centre.montant ??
              centre.stats?.montant ??
              0,
            avancesCount:
              centre.avancesCount ??
              centre.stats?.avancesCount ??
              0,
          }))
        : [];

      setCentres(normalizedCentres);

      if (!normalizedCentres.length) {
        setSelectedCentreId("");
        return;
      }

      const ownCentreId =
        authUser?.centre?.id ||
        authUser?.centre?._id ||
        "";

      const currentStillExists =
        normalizedCentres.some(
          (centre) =>
            String(centre.id) ===
              String(
                selectedCentreId
              ) &&
            centre.active !== false
        );

      if (
        currentStillExists
      ) {
        return;
      }

      if (
        !isSuperAdmin &&
        ownCentreId
      ) {
        setSelectedCentreId(
          String(ownCentreId)
        );
        return;
      }

      const preferred =
        normalizedCentres.find(
          (centre) =>
            String(centre.id) ===
              String(
                ownCentreId
              ) &&
            centre.active !== false
        ) ||
        normalizedCentres.find(
          (centre) =>
            centre.active !==
            false
        ) ||
        normalizedCentres[0];

      setSelectedCentreId(
        String(preferred.id)
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoadingCentres(false);
    }
  };

  const loadRecords = async () => {
    if (!selectedCentreId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response =
        await authFetch(
          centreScopedUrl(
            GASOIL_API
          )
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur de chargement des bons."
        );
      }

      setRecords(data);
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAvances = async () => {
    if (!selectedCentreId) {
      setAvances([]);
      setActiveAdvance(null);
      setLoadingAvances(false);
      return;
    }

    try {
      setLoadingAvances(true);

      const [
        allResponse,
        activeResponse,
      ] = await Promise.all([
        authFetch(
          centreScopedUrl(
            AVANCES_API
          )
        ),
        authFetch(
          centreScopedUrl(
            ACTIVE_AVANCE_API
          )
        ),
      ]);

      const allData =
        await allResponse.json();

      const activeData =
        await activeResponse.json();

      if (!allResponse.ok) {
        throw new Error(
          allData.message ||
            "Erreur de chargement des avances."
        );
      }

      if (!activeResponse.ok) {
        throw new Error(
          activeData.message ||
            "Erreur de chargement de l'avance active."
        );
      }

      setAvances(allData);
      setActiveAdvance(
        activeData
      );
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoadingAvances(false);
    }
  };

  const refreshAll = async () => {
    if (!selectedCentreId) {
      return;
    }

    await Promise.all([
      loadRecords(),
      loadAvances(),
    ]);
  };

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (
      authUser &&
      authToken
    ) {
      loadCentres();
    }
  }, [
    authUser,
    authToken,
  ]);

  useEffect(() => {
    if (
      authUser &&
      authToken &&
      selectedCentreId
    ) {
      refreshAll();
    }
  }, [
    authUser,
    authToken,
    selectedCentreId,
  ]);

  // =========================================================
  // USERS + CENTRES ADMINISTRATION
  // =========================================================

  const loadUsers = async () => {
    if (!canManageUsers) {
      return;
    }

    try {
      setLoadingUsers(true);

      const response =
        await authFetch(
          `${AUTH_API}/users`
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors du chargement des utilisateurs."
        );
      }

      setUsers(data);
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (
      page === "users" &&
      canManageUsers
    ) {
      loadUsers();
    }

    if (
      page === "centres" &&
      isSuperAdmin
    ) {
      loadCentres();
    }
  }, [
    page,
    authUser,
  ]);

  const defaultUserCentreId =
    selectedCentreId ||
    authUser?.centre?.id ||
    authUser?.centre?._id ||
    "";

  const openUserForm = () => {
    setEditingUser(null);

    setUserForm({
      matricule: "",
      password: "",
      name: "",
      role: "USER",
      centre:
        defaultUserCentreId,
    });

    setShowUserForm(true);
  };

  const openEditUserForm = (
    user
  ) => {
    setEditingUser(user);

    setUserForm({
      matricule:
        user.matricule || "",
      password: "",
      name:
        user.name || "",
      role:
        user.role || "USER",
      centre:
        user.centre?.id ||
        user.centre?._id ||
        defaultUserCentreId,
    });

    setShowUserForm(true);
  };

  const closeUserForm = () => {
    setShowUserForm(false);
    setEditingUser(null);

    setUserForm({
      matricule: "",
      password: "",
      name: "",
      role: "USER",
      centre:
        defaultUserCentreId,
    });
  };

  const handleUserFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setUserForm(
      (prev) => ({
        ...prev,
        [name]: value,
      })
    );
  };

  const handleSaveUser = async (
    event
  ) => {
    event.preventDefault();

    try {
      setSavingUser(true);
      setMessage("");

      const payload = {
        matricule:
          userForm.matricule,
        name:
          userForm.name,
        role:
          userForm.role,
        centre:
          userForm.centre,
      };

      if (
        userForm.password
      ) {
        payload.password =
          userForm.password;
      }

      const response =
        await authFetch(
          editingUser
            ? `${AUTH_API}/users/${editingUser.id}`
            : `${AUTH_API}/users`,
          {
            method:
              editingUser
                ? "PUT"
                : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            (editingUser
              ? "Erreur lors de la modification de l'utilisateur."
              : "Erreur lors de la création de l'utilisateur.")
        );
      }

      closeUserForm();
      await loadUsers();
      await loadCentres();
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (
    id
  ) => {
    if (
      !window.confirm(
        "Supprimer cet utilisateur ?"
      )
    ) {
      return;
    }

    try {
      const response =
        await authFetch(
          `${AUTH_API}/users/${id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors de la suppression de l'utilisateur."
        );
      }

      await loadUsers();
      await loadCentres();
    } catch (error) {
      setMessage(
        error.message
      );
    }
  };

  const openCentreForm = (
    centre = null
  ) => {
    setEditingCentre(
      centre
    );

    setCentreForm({
      name:
        centre?.name || "",
      code:
        centre?.code || "",
      active:
        centre?.active !==
        false,
    });

    setShowCentreForm(true);
  };

  const closeCentreForm = () => {
    setShowCentreForm(false);
    setEditingCentre(null);
    setCentreForm({
      name: "",
      code: "",
      active: true,
    });
  };

  const handleCentreFormChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setCentreForm(
      (prev) => ({
        ...prev,
        [name]:
          type ===
          "checkbox"
            ? checked
            : value,
      })
    );
  };

  const handleSaveCentre = async (
    event
  ) => {
    event.preventDefault();

    try {
      setSavingCentre(true);
      setMessage("");

      const response =
        await authFetch(
          editingCentre
            ? `${CENTRES_API}/${editingCentre.id}`
            : CENTRES_API,
          {
            method:
              editingCentre
                ? "PUT"
                : "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                centreForm
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors de l'enregistrement du centre."
        );
      }

      closeCentreForm();
      await loadCentres();

      const savedCentreId =
        data?.id ||
        data?._id ||
        "";

      if (
        !editingCentre &&
        savedCentreId
      ) {
        setSelectedCentreId(
          String(savedCentreId)
        );
      }
    } catch (error) {
      setMessage(
        error.message
      );
    } finally {
      setSavingCentre(false);
    }
  };

  const handleDeleteCentre = async (
    centre
  ) => {
    if (
      !window.confirm(
        `Supprimer le centre ${centre.name} ?`
      )
    ) {
      return;
    }

    try {
      const response =
        await authFetch(
          `${CENTRES_API}/${centre.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Erreur lors de la suppression du centre."
        );
      }

      await loadCentres();
    } catch (error) {
      setMessage(
        error.message
      );
    }
  };

  // =========================================================
  // DAILY DATA
  // =========================================================

  const dayRecords = useMemo(
    () => records.filter((item) => sameDay(item.date, selectedDate)),
    [records, selectedDate]
  );

  const filteredRecords = useMemo(() => {
    const text = search.trim().toLowerCase();

    if (!text) return dayRecords;

    return dayRecords.filter((item) =>
      [item.autocar, item.depart, item.numeroBon, item.observation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text))
    );
  }, [dayRecords, search]);

  const totalLitres = useMemo(
    () =>
      dayRecords.reduce(
        (sum, item) => sum + Number(item.quantite || 0),
        0
      ),
    [dayRecords]
  );

  const totalPrix = useMemo(
    () =>
      dayRecords.reduce(
        (sum, item) => sum + Number(item.prixTotal || 0),
        0
      ),
    [dayRecords]
  );


  // =========================================================
  // DAILY RANKINGS
  // =========================================================

  const topAutocars = useMemo(() => {
    const grouped = {};

    dayRecords.forEach((item) => {
      const key = item.autocar || "Sans autocar";
      grouped[key] = (grouped[key] || 0) + Number(item.quantite || 0);
    });

    return Object.entries(grouped)
      .map(([name, litres]) => ({
        name: `Autocar ${name}`,
        litres,
      }))
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 5);
  }, [dayRecords]);

  const topActivities = useMemo(() => {
    const grouped = {};

    dayRecords.forEach((item) => {
      const autocar = item.autocar || "Sans autocar";
      const depart = item.depart || "Sans départ";
      const key = `${autocar}|||${depart}`;

      if (!grouped[key]) {
        grouped[key] = {
          autocar,
          depart,
          litres: 0,
          montant: 0,
        };
      }

      grouped[key].litres += Number(item.quantite || 0);
      grouped[key].montant += Number(item.prixTotal || 0);
    });

    return Object.values(grouped)
      .sort((a, b) => b.litres - a.litres)
      .slice(0, 5);
  }, [dayRecords]);

  const autocarChartData = useMemo(
    () =>
      topAutocars.map((item) => ({
        name: item.name.replace("Autocar ", ""),
        litres: item.litres,
      })),
    [topAutocars]
  );

  // =========================================================
  // DATE
  // =========================================================

  const selectedDateLabel = new Date(
    `${selectedDate}T12:00:00`
  ).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const changeDay = (direction) => {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + direction);
    setSelectedDate(date.toISOString().split("T")[0]);
  };

  // =========================================================
  // ACTIVE ADVANCE
  // =========================================================

  const advancePercentUsed = Math.min(
    Number(activeAdvance?.pourcentage || 0),
    100
  );

  const advanceRemainingPercent =
    activeAdvance && Number(activeAdvance.montant) > 0
      ? (Number(activeAdvance.solde || 0) / Number(activeAdvance.montant)) * 100
      : 0;

  const advanceHealth = useMemo(() => {
    if (!activeAdvance) {
      return {
        label: "Aucune avance active",
        description: "Ajoutez un chèque d'avance avant de saisir des bons.",
        tone: "slate",
        icon: <AlertTriangle size={20} />,
      };
    }

    if (advanceRemainingPercent < 5) {
      return {
        label: "Nouvelle avance nécessaire",
        description: "Le solde disponible est presque épuisé.",
        tone: "red",
        icon: <AlertTriangle size={20} />,
      };
    }

    if (advanceRemainingPercent <= 20) {
      return {
        label: "Avance bientôt épuisée",
        description: "Préparez le prochain chèque d'avance.",
        tone: "amber",
        icon: <AlertTriangle size={20} />,
      };
    }

    return {
      label: "Solde confortable",
      description: "L'avance active dispose encore d'un solde suffisant.",
      tone: "emerald",
      icon: <CheckCircle2 size={20} />,
    };
  }, [activeAdvance, advanceRemainingPercent]);

  // =========================================================
  // GASOIL FORM
  // =========================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => {
      const nextForm = {
        ...prev,
        [name]: value,
      };

      if (
        name === "quantite" ||
        name === "prixUnitaire"
      ) {
        const quantity = Number(
          name === "quantite"
            ? value
            : prev.quantite
        );

        const unitPrice = Number(
          name === "prixUnitaire"
            ? value
            : prev.prixUnitaire
        );

        nextForm.prixTotal =
          Number.isFinite(quantity) &&
          quantity > 0 &&
          Number.isFinite(unitPrice) &&
          unitPrice > 0
            ? (quantity * unitPrice).toFixed(2)
            : "";
      }

      return nextForm;
    });
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0] || null;

    setForm((prev) => ({
      ...prev,
      imageBon: file,
    }));

    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const resetForm = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setForm({
      date: selectedDate,
      autocar: "",
      depart: "",
      quantite: "",
      numeroBon: "",
      prixUnitaire: String(DEFAULT_UNIT_PRICE),
      prixTotal: "",
      observation: "",
      imageBon: null,
    });

    setPreview("");
  };

  const openForm = () => {
    if (!activeAdvance) {
      setPage("avances");
      setMessage(
        "Aucune avance active. Ajoutez d'abord le chèque d'avance de la station."
      );
      return;
    }

    setEditingRecord(null);
    resetForm();

    setForm((prev) => ({
      ...prev,
      date: selectedDate,
    }));

    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingRecord(item);

    setForm({
      date: new Date(item.date).toISOString().split("T")[0],
      autocar: item.autocar || "",
      depart: item.depart || "",
      quantite: item.quantite ?? "",
      numeroBon: item.numeroBon || "",
      prixUnitaire:
        Number(item.quantite) > 0
          ? (
              Number(item.prixTotal || 0) /
              Number(item.quantite)
            ).toFixed(2)
          : String(DEFAULT_UNIT_PRICE),
      prixTotal: item.prixTotal ?? "",
      observation: item.observation || "",
      imageBon: null,
    });

    setPreview(
      item.imageBon
        ? resolveFileUrl(item.imageBon)
        : ""
    );

    setShowForm(true);
  };

  const closeForm = () => {
    resetForm();
    setEditingRecord(null);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const formData = new FormData();

      formData.append("date", form.date);
      formData.append("autocar", form.autocar);
      formData.append("depart", form.depart);
      formData.append("quantite", form.quantite);
      formData.append("numeroBon", form.numeroBon);
      formData.append("prixTotal", form.prixTotal);
      formData.append("observation", form.observation);
      formData.append("centre", selectedCentreId);

      if (form.imageBon) {
        formData.append("imageBon", form.imageBon);
      }

      const requestUrl = editingRecord
        ? `${GASOIL_API}/${editingRecord._id}`
        : GASOIL_API;

      const response = await authFetch(requestUrl, {
        method: editingRecord ? "PUT" : "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "INSUFFICIENT_ADVANCE") {
          throw new Error(
            `Solde insuffisant. Solde: ${formatMoney(
              data.solde
            )} DH — Bon: ${formatMoney(
              data.montantBon
            )} DH — Manque: ${formatMoney(data.manque)} DH.`
          );
        }

        throw new Error(
          data.message ||
            (editingRecord
              ? "Erreur lors de la modification du bon."
              : "Erreur lors de l'enregistrement du bon.")
        );
      }

      closeForm();
      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer ce bon ?")) return;

    try {
      const response = await authFetch(`${GASOIL_API}/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Erreur lors de la suppression.");
      }

      await refreshAll();
    } catch (error) {
      setMessage(error.message);
    }
  };

  // =========================================================
  // ADVANCE FORM
  // =========================================================

  const handleAdvanceChange = (event) => {
    const { name, value } = event.target;

    setAdvanceForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAdvanceImage = (event) => {
    const file = event.target.files?.[0] || null;

    setAdvanceForm((prev) => ({
      ...prev,
      imageCheque: file,
    }));

    if (advancePreview) {
      URL.revokeObjectURL(advancePreview);
    }

    setAdvancePreview(file ? URL.createObjectURL(file) : "");
  };

  const resetAdvanceForm = () => {
    if (advancePreview) {
      URL.revokeObjectURL(advancePreview);
    }

    setAdvanceForm({
      date: todayISO(),
      montant: "",
      numeroCheque: "",
      station: "",
      banque: "",
      observation: "",
      imageCheque: null,
    });

    setAdvancePreview("");
  };

  const openAdvanceForm = () => {
    resetAdvanceForm();
    setShowAdvanceForm(true);
  };

  const closeAdvanceForm = () => {
    resetAdvanceForm();
    setShowAdvanceForm(false);
  };

  const handleAdvanceSubmit = async (event) => {
    event.preventDefault();

    if (
      activeAdvance &&
      Number(activeAdvance.solde || 0) > 0 &&
      !window.confirm(
        `L'avance actuelle dispose encore de ${formatMoney(
          activeAdvance.solde
        )} DH. Créer une nouvelle avance clôturera l'ancienne. Continuer ?`
      )
    ) {
      return;
    }

    try {
      setSavingAdvance(true);
      setMessage("");

      const formData = new FormData();

      formData.append("date", advanceForm.date);
      formData.append("montant", advanceForm.montant);
      formData.append("numeroCheque", advanceForm.numeroCheque);
      formData.append("station", advanceForm.station);
      formData.append("banque", advanceForm.banque);
      formData.append("observation", advanceForm.observation);
      formData.append("centre", selectedCentreId);

      if (advanceForm.imageCheque) {
        formData.append("imageCheque", advanceForm.imageCheque);
      }

      const response = await authFetch(AVANCES_API, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Erreur lors de l'enregistrement de l'avance."
        );
      }

      closeAdvanceForm();
      await loadAvances();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingAdvance(false);
    }
  };

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportDailyExcel = async () => {
    if (dayRecords.length === 0) {
      alert("Aucun bon à exporter pour cette journée.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Suivi Gasoil Autocar";
    workbook.company = "Suivi Gasoil Autocar";
    workbook.subject = "Suivi quotidien des prises gasoil";
    workbook.created = new Date();

    const fileDate =
      selectedDate
        .split("-")
        .reverse()
        .join("-");

    const displayDate =
      selectedDate
        .split("-")
        .reverse()
        .join("/");

    const stationName =
      activeAdvance?.station?.trim() ||
      "STATION EXTERNE";

    // ========================================================
    // UNIT PRICE ANALYSIS
    // ========================================================

    const unitPriceGroups = new Map();

    dayRecords.forEach((item) => {
      const quantity =
        Number(item.quantite || 0);

      const total =
        Number(item.prixTotal || 0);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(total) ||
        total <= 0
      ) {
        return;
      }

      const unitPrice =
        Number(
          (
            total /
            quantity
          ).toFixed(2)
        );

      const key =
        unitPrice.toFixed(2);

      if (!unitPriceGroups.has(key)) {
        unitPriceGroups.set(
          key,
          {
            price: unitPrice,
            bons: [],
          }
        );
      }

      unitPriceGroups
        .get(key)
        .bons.push(
          item.numeroBon ||
            "Sans numéro"
        );
    });

    const groupedUnitPrices =
      Array.from(
        unitPriceGroups.values()
      ).sort(
        (a, b) =>
          a.price - b.price
      );

    const hasVariableUnitPrice =
      groupedUnitPrices.length > 1;

    const singleUnitPrice =
      groupedUnitPrices.length === 1
        ? groupedUnitPrices[0].price
        : null;

    const priceSummaryRows =
      hasVariableUnitPrice
        ? groupedUnitPrices.length
        : 1;

    const tableHeaderRow =
      10 + priceSummaryRows;

    const firstDataRow =
      tableHeaderRow + 1;

    const lastDataRow =
      firstDataRow +
      dayRecords.length -
      1;

    const totalRowNumber =
      lastDataRow + 1;

    const footerRowNumber =
      totalRowNumber + 2;

    const worksheet =
      workbook.addWorksheet(
        fileDate,
        {
          views: [
            {
              state: "frozen",
              ySplit:
                tableHeaderRow,
            },
          ],
          properties: {
            defaultRowHeight: 20,
          },
        }
      );

    // ========================================================
    // PREMIUM COLOR SYSTEM
    // ========================================================

    const NAVY = "FF0F172A";
    const NAVY_2 = "FF172554";
    const BLUE = "FF2563EB";
    const BLUE_2 = "FF1D4ED8";
    const SKY = "FFEFF6FF";
    const EMERALD = "FF059669";
    const EMERALD_BG = "FFECFDF5";
    const AMBER = "FFD97706";
    const AMBER_BG = "FFFFF7ED";
    const VIOLET = "FF7C3AED";
    const VIOLET_BG = "FFF5F3FF";
    const SLATE = "FF475569";
    const SLATE_LIGHT = "FFF8FAFC";
    const BORDER = "FFD7E0EA";
    const WHITE = "FFFFFFFF";

    const setThinBorder =
      (cell, color = BORDER) => {
        cell.border = {
          top: {
            style: "thin",
            color: { argb: color },
          },
          left: {
            style: "thin",
            color: { argb: color },
          },
          bottom: {
            style: "thin",
            color: { argb: color },
          },
          right: {
            style: "thin",
            color: { argb: color },
          },
        };
      };

    const fillCell =
      (cell, argb) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb },
        };
      };

    // ========================================================
    // TITLE
    // ========================================================

    worksheet.mergeCells(
      "A1:H1"
    );

    const titleCell =
      worksheet.getCell("A1");

    titleCell.value =
      "SUIVI GASOIL AUTOCAR";

    titleCell.font = {
      name: "Aptos Display",
      size: 22,
      bold: true,
      color: {
        argb: WHITE,
      },
    };

    titleCell.alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    fillCell(
      titleCell,
      NAVY
    );

    worksheet.getRow(1).height =
      38;

    worksheet.mergeCells(
      "A2:H2"
    );

    const subtitleCell =
      worksheet.getCell("A2");

    subtitleCell.value =
      `État des prises gasoil • ${activeCentre?.name || "Centre"} • ${stationName} • ${displayDate}`;

    subtitleCell.font = {
      name: "Aptos",
      size: 12,
      bold: true,
      color: {
        argb: "FFBFDBFE",
      },
    };

    subtitleCell.alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    fillCell(
      subtitleCell,
      NAVY_2
    );

    worksheet.getRow(2).height =
      25;

    // ========================================================
    // PREMIUM KPI CARDS
    // ========================================================

    const kpis = [
      {
        range: "A4:B4",
        valueRange: "A5:B5",
        label: "BONS DU JOUR",
        value: `${dayRecords.length}`,
        bg: SKY,
        color: BLUE_2,
      },
      {
        range: "C4:E4",
        valueRange: "C5:E5",
        label: "QUANTITÉ TOTALE",
        value: `${formatNumber(totalLitres)} L`,
        bg: EMERALD_BG,
        color: EMERALD,
      },
      {
        range: "F4:H4",
        valueRange: "F5:H5",
        label: "MONTANT TOTAL",
        value: `${formatMoney(totalPrix)} DH`,
        bg: VIOLET_BG,
        color: VIOLET,
      },
    ];

    kpis.forEach((kpi) => {
      worksheet.mergeCells(
        kpi.range
      );

      worksheet.mergeCells(
        kpi.valueRange
      );

      const labelCell =
        worksheet.getCell(
          kpi.range.split(":")[0]
        );

      const valueCell =
        worksheet.getCell(
          kpi.valueRange.split(":")[0]
        );

      labelCell.value =
        kpi.label;

      labelCell.font = {
        name: "Aptos",
        size: 9,
        bold: true,
        color: {
          argb: SLATE,
        },
      };

      labelCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      valueCell.value =
        kpi.value;

      valueCell.font = {
        name: "Aptos Display",
        size: 15,
        bold: true,
        color: {
          argb: kpi.color,
        },
      };

      valueCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      fillCell(
        labelCell,
        kpi.bg
      );

      fillCell(
        valueCell,
        kpi.bg
      );

      setThinBorder(
        labelCell
      );

      setThinBorder(
        valueCell
      );
    });

    worksheet.getRow(4).height =
      22;

    worksheet.getRow(5).height =
      28;

    // ========================================================
    // UNIT PRICE PANEL
    // ========================================================

    worksheet.mergeCells(
      "A7:H7"
    );

    const priceHeaderCell =
      worksheet.getCell("A7");

    priceHeaderCell.value =
      hasVariableUnitPrice
        ? "PRIX UNITAIRES UTILISÉS"
        : "PRIX UNITAIRE AFFICHÉ À LA STATION";

    priceHeaderCell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: {
        argb: WHITE,
      },
    };

    priceHeaderCell.alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    fillCell(
      priceHeaderCell,
      BLUE_2
    );

    worksheet.getRow(7).height =
      24;

    if (
      !hasVariableUnitPrice
    ) {
      worksheet.mergeCells(
        "A8:D8"
      );

      worksheet.mergeCells(
        "E8:H8"
      );

      const labelCell =
        worksheet.getCell("A8");

      const valueCell =
        worksheet.getCell("E8");

      labelCell.value =
        "Prix appliqué à tous les bons";

      valueCell.value =
        singleUnitPrice ??
        DEFAULT_UNIT_PRICE;

      valueCell.numFmt =
        '#,##0.00 "DH/L"';

      labelCell.font = {
        name: "Aptos",
        size: 10,
        bold: true,
        color: {
          argb: SLATE,
        },
      };

      valueCell.font = {
        name: "Aptos Display",
        size: 14,
        bold: true,
        color: {
          argb: AMBER,
        },
      };

      labelCell.alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      valueCell.alignment = {
        vertical: "middle",
        horizontal: "right",
      };

      fillCell(
        labelCell,
        AMBER_BG
      );

      fillCell(
        valueCell,
        AMBER_BG
      );

      setThinBorder(
        labelCell
      );

      setThinBorder(
        valueCell
      );

      worksheet.getRow(8).height =
        28;
    } else {
      groupedUnitPrices.forEach(
        (group, index) => {
          const rowNumber =
            8 + index;

          worksheet.mergeCells(
            `A${rowNumber}:B${rowNumber}`
          );

          worksheet.mergeCells(
            `C${rowNumber}:H${rowNumber}`
          );

          const priceCell =
            worksheet.getCell(
              `A${rowNumber}`
            );

          const bonsCell =
            worksheet.getCell(
              `C${rowNumber}`
            );

          priceCell.value =
            group.price;

          priceCell.numFmt =
            '#,##0.00 "DH/L"';

          bonsCell.value =
            `Bons : ${group.bons.join(
              ", "
            )}`;

          priceCell.font = {
            name: "Aptos Display",
            size: 11,
            bold: true,
            color: {
              argb: AMBER,
            },
          };

          bonsCell.font = {
            name: "Aptos",
            size: 10,
            bold: true,
            color: {
              argb: NAVY,
            },
          };

          priceCell.alignment = {
            vertical: "middle",
            horizontal: "center",
          };

          bonsCell.alignment = {
            vertical: "middle",
            horizontal: "left",
            wrapText: true,
          };

          fillCell(
            priceCell,
            AMBER_BG
          );

          fillCell(
            bonsCell,
            AMBER_BG
          );

          setThinBorder(
            priceCell
          );

          setThinBorder(
            bonsCell
          );

          worksheet.getRow(
            rowNumber
          ).height = 26;
        }
      );
    }

    // ========================================================
    // TABLE - EXACT BUSINESS ORDER REQUESTED
    // Date | Bon | Autocar | Départ | Quantité | Prix total |
    // Photo | Saisi par
    // ========================================================

    const headerRow =
      worksheet.getRow(
        tableHeaderRow
      );

    headerRow.values = [
      "Date",
      "N° Bon",
      "Autocar",
      "Départ",
      "Quantité (L)",
      "Prix total (DH)",
      "Photo",
      "Saisi par",
    ];

    headerRow.height = 30;

    headerRow.eachCell(
      (cell) => {
        cell.font = {
          name: "Aptos",
          size: 10,
          bold: true,
          color: {
            argb: WHITE,
          },
        };

        fillCell(
          cell,
          BLUE
        );

        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };

        cell.border = {
          top: {
            style: "thin",
            color: {
              argb: "FF60A5FA",
            },
          },
          left: {
            style: "thin",
            color: {
              argb: "FF60A5FA",
            },
          },
          bottom: {
            style: "thin",
            color: {
              argb: "FF1E40AF",
            },
          },
          right: {
            style: "thin",
            color: {
              argb: "FF60A5FA",
            },
          },
        };
      }
    );

    for (
      let index = 0;
      index <
      dayRecords.length;
      index += 1
    ) {
      const item =
        dayRecords[index];

      const rowNumber =
        firstDataRow + index;

      const photoUrl =
        item.imageBon
          ? resolveFileUrl(
              item.imageBon
            )
          : "";

      const itemDate =
        new Date(
          item.date
        ).toLocaleDateString(
          "fr-FR"
        );

      const creator =
        auditUserLabel(
          item,
          "createdBy"
        );

      const createdTime =
        item.createdAt
          ? formatDateTime(
              item.createdAt
            )
          : "";

      const row =
        worksheet.getRow(
          rowNumber
        );

      row.values = [
        itemDate,
        item.numeroBon || "",
        item.autocar || "",
        item.depart || "",
        Number(
          item.quantite || 0
        ),
        Number(
          item.prixTotal || 0
        ),
        photoUrl
          ? "Voir bon"
          : "Sans photo",
        createdTime
          ? `${creator}\n${createdTime}`
          : creator,
      ];

      row.height = 34;

      row.getCell(5).numFmt =
        '#,##0.00';

      row.getCell(6).numFmt =
        '#,##0.00';

      row.eachCell(
        (cell) => {
          cell.font = {
            name: "Aptos",
            size: 10,
            bold:
              cell.col === 2 ||
              cell.col === 3,
            color: {
              argb:
                cell.col === 2
                  ? "FFB45309"
                  : cell.col === 3
                    ? BLUE_2
                    : NAVY,
            },
          };

          cell.alignment = {
            vertical: "middle",
            horizontal:
              cell.col === 4 ||
              cell.col === 8
                ? "left"
                : "center",
            wrapText: true,
          };

          setThinBorder(
            cell
          );

          fillCell(
            cell,
            index % 2 === 0
              ? WHITE
              : SLATE_LIGHT
          );
        }
      );

      // Accent cells
      fillCell(
        row.getCell(2),
        "FFFFFBEB"
      );

      fillCell(
        row.getCell(3),
        SKY
      );

      // Photo: clean clickable link only (no thumbnail in Excel)
      if (photoUrl) {
        row.getCell(7).value = {
          text: "Voir bon",
          hyperlink: photoUrl,
        };

        row.getCell(7).font = {
          name: "Aptos",
          size: 10,
          bold: true,
          color: {
            argb: BLUE_2,
          },
          underline: true,
        };

        row.getCell(7).alignment = {
          vertical: "middle",
          horizontal: "center",
        };
      }
    }

    // ========================================================
    // TOTAL ROW
    // ========================================================

    worksheet.mergeCells(
      `A${totalRowNumber}:D${totalRowNumber}`
    );

    const totalLabel =
      worksheet.getCell(
        `A${totalRowNumber}`
      );

    totalLabel.value =
      "TOTAL JOURNÉE";

    totalLabel.font = {
      name: "Aptos Display",
      size: 12,
      bold: true,
      color: {
        argb: WHITE,
      },
    };

    totalLabel.alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    fillCell(
      totalLabel,
      NAVY_2
    );

    setThinBorder(
      totalLabel,
      NAVY_2
    );

    const totalQuantityCell =
      worksheet.getCell(
        `E${totalRowNumber}`
      );

    totalQuantityCell.value = {
      formula:
        `SUM(E${firstDataRow}:E${lastDataRow})`,
      result:
        totalLitres,
    };

    totalQuantityCell.numFmt =
      '#,##0.00';

    const totalAmountCell =
      worksheet.getCell(
        `F${totalRowNumber}`
      );

    totalAmountCell.value = {
      formula:
        `SUM(F${firstDataRow}:F${lastDataRow})`,
      result:
        totalPrix,
    };

    totalAmountCell.numFmt =
      '#,##0.00';

    [
      totalQuantityCell,
      totalAmountCell,
    ].forEach((cell) => {
      cell.font = {
        name: "Aptos Display",
        size: 12,
        bold: true,
        color: {
          argb: WHITE,
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      fillCell(
        cell,
        BLUE_2
      );

      setThinBorder(
        cell,
        BLUE_2
      );
    });

    worksheet.mergeCells(
      `G${totalRowNumber}:H${totalRowNumber}`
    );

    const totalBonsCell =
      worksheet.getCell(
        `G${totalRowNumber}`
      );

    totalBonsCell.value =
      `${dayRecords.length} bon${
        dayRecords.length > 1
          ? "s"
          : ""
      }`;

    totalBonsCell.font = {
      name: "Aptos",
      size: 10,
      bold: true,
      color: {
        argb: NAVY_2,
      },
    };

    totalBonsCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    fillCell(
      totalBonsCell,
      SKY
    );

    setThinBorder(
      totalBonsCell,
      BLUE
    );

    worksheet.getRow(
      totalRowNumber
    ).height = 30;

    // ========================================================
    // FOOTER
    // ========================================================

    worksheet.mergeCells(
      `A${footerRowNumber}:H${footerRowNumber}`
    );

    const footerCell =
      worksheet.getCell(
        `A${footerRowNumber}`
      );

    footerCell.value =
      `Suivi Gasoil Autocar • Export généré le ${new Date().toLocaleString(
        "fr-FR"
      )}`;

    footerCell.font = {
      name: "Aptos",
      size: 9,
      italic: true,
      color: {
        argb: "FF94A3B8",
      },
    };

    footerCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // ========================================================
    // COLUMN WIDTHS / FILTER / PRINT
    // ========================================================

    worksheet.columns = [
      { width: 15 },
      { width: 18 },
      { width: 14 },
      { width: 30 },
      { width: 16 },
      { width: 18 },
      { width: 13 },
      { width: 34 },
    ];

    worksheet.autoFilter = {
      from:
        `A${tableHeaderRow}`,
      to:
        `H${tableHeaderRow}`,
    };

    worksheet.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: {
        left: 0.25,
        right: 0.25,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15,
      },
    };

    worksheet.headerFooter = {
      oddHeader:
        `&L&"Aptos,Bold"SUIVI GASOIL AUTOCAR&C${displayDate}&R${stationName}`,
      oddFooter:
        '&LConfidentiel&CPage &P / &N&R© Suivi Gasoil Autocar',
    };

    worksheet.properties.pageSetUpPr =
      {
        fitToPage: true,
      };

    worksheet.eachRow(
      (row) => {
        row.eachCell(
          (cell) => {
            if (
              !cell.font?.name
            ) {
              cell.font = {
                ...cell.font,
                name: "Aptos",
              };
            }
          }
        );
      }
    );

    const buffer =
      await workbook.xlsx.writeBuffer();

    saveAs(
      new Blob(
        [buffer],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      ),
      `Suivi_Gasoil_${fileDate}.xlsx`
    );
  };

  // =========================================================
  // UI
  // =========================================================

  if (authLoading) {
    return <AuthSplash />;
  }

  if (!authUser) {
    return (
      <AuthScreen
        setupRequired={setupRequired}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f6fb] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1760px] items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 xl:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-3 xl:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200 sm:h-12 sm:w-12 sm:rounded-2xl">
              <BusFront size={25} />
            </div>

            <div className="min-w-0">
              <h1 className="whitespace-nowrap text-base font-black tracking-tight sm:text-xl xl:text-2xl">
                Suivi Gasoil Autocar
              </h1>
              <p className="hidden whitespace-nowrap text-xs text-slate-500 2xl:block 2xl:text-sm">
                Suivi quotidien des bons et avances station
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 xl:gap-3">
            <div className="hidden shrink-0 rounded-xl bg-slate-100 p-1 lg:flex">
              <NavButton
                active={page === "suivi"}
                onClick={() => setPage("suivi")}
                icon={<LayoutList size={17} />}
                label="Suivi quotidien"
              />

              <NavButton
                active={page === "resume"}
                onClick={() => setPage("resume")}
                icon={<BarChart3 size={17} />}
                label="Résumé quotidien"
              />

              <NavButton
                active={page === "avances"}
                onClick={() => setPage("avances")}
                icon={<CreditCard size={17} />}
                label="Avances station"
              />

              {canManageUsers && (
                <NavButton
                  active={page === "users"}
                  onClick={() => setPage("users")}
                  icon={<UsersRound size={17} />}
                  label="Utilisateurs"
                />
              )}

              {isSuperAdmin && (
                <NavButton
                  active={page === "centres"}
                  onClick={() => setPage("centres")}
                  icon={<Landmark size={17} />}
                  label="Centres"
                />
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2 md:flex">
              <Landmark
                size={17}
                className="text-blue-600"
              />

              {isSuperAdmin ? (
                <select
                  value={selectedCentreId}
                  onChange={(event) => {
                    setRecords([]);
                    setAvances([]);
                    setActiveAdvance(null);
                    setSelectedCentreId(
                      event.target.value
                    );
                    setPage("suivi");
                  }}
                  disabled={loadingCentres}
                  className="max-w-44 bg-transparent text-sm font-black text-blue-950 outline-none"
                >
                  {centres
                    .filter(
                      (centre) =>
                        centre.active !== false
                    )
                    .map(
                      (centre) => (
                        <option
                          key={centre.id}
                          value={centre.id}
                        >
                          {centre.name}
                        </option>
                      )
                    )}
                </select>
              ) : (
                <span className="max-w-36 truncate text-sm font-black text-blue-950">
                  {activeCentre?.name ||
                    "Centre"}
                </span>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 2xl:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 text-white">
                <UserRound size={17} />
              </div>

              <div className="max-w-36 leading-tight">
                <p className="truncate text-sm font-black text-slate-800">
                  {authUser.name}
                </p>
                <p className="truncate text-[11px] font-semibold text-slate-400">
                  {authUser.matricule || authUser.email}
                </p>
                <p className="truncate text-[10px] font-bold text-blue-500">
                  {authUser.role} · {activeCentre?.code || authUser.centre?.code || "—"}
                </p>
              </div>

              <button
                onClick={openPasswordForm}
                title="Changer mon mot de passe"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
              >
                <KeyRound size={17} />
              </button>

              <button
                onClick={handleLogout}
                title="Déconnexion"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <LogOut size={17} />
              </button>
            </div>

            <button
              onClick={openPasswordForm}
              title="Changer mon mot de passe"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 sm:flex 2xl:hidden"
            >
              <KeyRound size={18} />
            </button>

            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-11 sm:w-11 2xl:hidden"
            >
              <LogOut size={18} />
            </button>

            {page === "avances" ? (
              canManageUsers ? (
                <button
                  onClick={openAdvanceForm}
                  className="hidden shrink-0 items-center whitespace-nowrap gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 sm:flex"
                >
                  <Plus size={18} />
                  Nouvelle avance
                </button>
              ) : null
            ) : page === "users" && canManageUsers ? (
              <button
                onClick={openUserForm}
                className="hidden shrink-0 items-center whitespace-nowrap gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-bold text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 sm:flex"
              >
                <UserPlus size={18} />
                Nouveau compte
              </button>
            ) : page === "centres" && isSuperAdmin ? (
              <button
                onClick={() => openCentreForm()}
                className="hidden shrink-0 items-center whitespace-nowrap gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-blue-900 px-5 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 sm:flex"
              >
                <Plus size={18} />
                Nouveau centre
              </button>
            ) : null}
          </div>
        </div>
        <div className="border-t border-slate-100 px-3 pb-3 lg:hidden">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavButton active={page === "suivi"} onClick={() => setPage("suivi")} icon={<LayoutList size={16} />} label="Suivi" />
            <NavButton active={page === "resume"} onClick={() => setPage("resume")} icon={<BarChart3 size={16} />} label="Résumé" />
            <NavButton active={page === "avances"} onClick={() => setPage("avances")} icon={<CreditCard size={16} />} label="Avances" />
            {canManageUsers && (
              <NavButton active={page === "users"} onClick={() => setPage("users")} icon={<UsersRound size={16} />} label="Utilisateurs" />
            )}
            {isSuperAdmin && (
              <NavButton active={page === "centres"} onClick={() => setPage("centres")} icon={<Landmark size={16} />} label="Centres" />
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 md:hidden">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <Landmark size={16} className="shrink-0 text-blue-600" />
              {isSuperAdmin ? (
                <select
                  value={selectedCentreId}
                  onChange={(event) => {
                    setRecords([]);
                    setAvances([]);
                    setActiveAdvance(null);
                    setSelectedCentreId(event.target.value);
                    setPage("suivi");
                  }}
                  disabled={loadingCentres}
                  className="min-w-0 flex-1 bg-transparent text-sm font-black text-blue-950 outline-none"
                >
                  {centres.filter((centre) => centre.active !== false).map((centre) => (
                    <option key={centre.id} value={centre.id}>{centre.name}</option>
                  ))}
                </select>
              ) : (
                <span className="truncate text-sm font-black text-blue-950">{activeCentre?.name || "Centre"}</span>
              )}
            </div>

            <button
              onClick={openPasswordForm}
              title="Changer mon mot de passe"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
            >
              <KeyRound size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-7">
        {message && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <span>{message}</span>

            <button onClick={() => setMessage("")}>
              <X size={18} />
            </button>
          </div>
        )}

        {(page === "suivi" || page === "resume") && (
          <>
            <div className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-400">
                  {page === "suivi" ? "Suivi quotidien" : "Résumé quotidien"}
                </p>

                <h2 className="mt-1 text-2xl font-black capitalize sm:text-3xl">
                  {selectedDateLabel}
                </h2>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-blue-700">
                  <Landmark size={14} />
                  Centre {activeCentre?.name || "—"}
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
                {page === "suivi" && (
                  <button
                    onClick={openForm}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 sm:px-4 sm:text-base"
                  >
                    <Plus size={19} />
                    Nouveau bon
                  </button>
                )}

                <button
                  onClick={exportDailyExcel}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 sm:px-4 sm:text-base"
                >
                  <FileSpreadsheet size={19} />
                  Export Excel
                </button>

                <button
                  onClick={() => changeDay(-1)}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:bg-slate-50"
                >
                  <ChevronLeft size={20} />
                </button>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="col-span-2 min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold shadow-sm outline-none sm:col-span-1 sm:px-4 sm:text-base"
                />

                <button
                  onClick={() => changeDay(1)}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:bg-slate-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="mb-5">
              <CompactAdvanceStatus
                activeAdvance={activeAdvance}
                health={advanceHealth}
                onOpen={() => setPage("avances")}
              />
            </div>

            <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                icon={<CalendarDays />}
                label="Bons du jour"
                value={dayRecords.length}
                accent="blue"
              />

              <SummaryCard
                icon={<Fuel />}
                label="Quantité totale"
                value={`${formatNumber(totalLitres)} L`}
                accent="emerald"
              />

              <SummaryCard
                icon={<Wallet />}
                label="Montant total"
                value={`${formatMoney(totalPrix)} DH`}
                accent="violet"
              />

              <SummaryCard
                icon={<CreditCard />}
                label="Solde avance"
                value={
                  activeAdvance
                    ? `${formatMoney(activeAdvance.solde)} DH`
                    : "Aucune"
                }
                accent="amber"
              />
            </div>
          </>
        )}

        {page === "suivi" && (
          <section className="overflow-hidden rounded-2xl border border-white bg-white shadow-xl shadow-slate-200/60 sm:rounded-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <div>
                <h3 className="text-xl font-black">
                  Bons du jour
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {dayRecords.length} enregistrement(s)
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Rechercher..."
                  className="w-full rounded-xl bg-slate-100 py-3 pl-10 pr-4 outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-16 text-center text-slate-400">
                Chargement...
              </div>
            ) : filteredRecords.length === 0 ? (
              <EmptyBlock />
            ) : (
              <>
                {/* PHONE: readable cards instead of squeezing the desktop table */}
                <div className="space-y-3 p-3 md:hidden">
                  {filteredRecords.map((item) => {
                    const canDelete =
                      ["ADMIN", "SUPER_ADMIN"].includes(authUser.role) ||
                      String(item.createdBy || "") === String(authUser.id || "");

                    return (
                      <article
                        key={item._id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/80 p-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-black text-amber-700">
                                Bon N° {item.numeroBon}
                              </span>
                              <span className="text-xs font-bold text-slate-400">
                                {formatDate(item.date)}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">
                                <BusFront size={16} />
                                {item.autocar}
                              </span>
                              <span className="min-w-0 break-words text-sm font-black leading-5 text-slate-800">
                                {item.depart || "—"}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              onClick={() => openEditForm(item)}
                              title="Modifier"
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition active:scale-95"
                            >
                              <Pencil size={18} />
                            </button>

                            {canDelete && (
                              <button
                                onClick={() => handleDelete(item._id)}
                                title="Supprimer"
                                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 transition active:scale-95"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 p-4">
                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                              Quantité
                            </p>
                            <p className="mt-1 whitespace-nowrap text-lg font-black text-slate-900">
                              {formatNumber(item.quantite)} L
                            </p>
                          </div>

                          <div className="rounded-xl bg-violet-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-600">
                              Prix total
                            </p>
                            <p className="mt-1 whitespace-nowrap text-lg font-black text-slate-900">
                              {formatMoney(item.prixTotal)} DH
                            </p>
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          {item.imageBon ? (
                            <a
                              href={resolveFileUrl(item.imageBon)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
                            >
                              <img
                                src={cloudinaryImageUrl(item.imageBon, {
                                  width: 480,
                                  quality: "auto:eco",
                                })}
                                alt={`Bon ${item.numeroBon}`}
                                loading="lazy"
                                decoding="async"
                                className="h-16 w-20 shrink-0 rounded-lg border border-slate-200 object-cover"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800">
                                  Photo du bon
                                </p>
                                <p className="mt-0.5 text-xs font-semibold text-blue-600">
                                  Appuyer pour agrandir
                                </p>
                              </div>
                              <Eye size={18} className="ml-auto shrink-0 text-slate-400" />
                            </a>
                          ) : (
                            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-slate-400">
                              <ImageIcon size={20} />
                              <span className="text-sm font-bold">Sans photo</span>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 px-4 py-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className="mt-0.5 shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-600">
                              Saisi
                            </span>
                            <div className="min-w-0">
                              <p className="break-words text-xs font-black text-slate-700">
                                {auditUserLabel(item, "createdBy")}
                              </p>
                              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleTimeString("fr-FR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "—"}
                              </p>
                            </div>
                          </div>

                          {(item.updatedBy ||
                            item.updatedByName ||
                            item.updatedByMatricule ||
                            item.updatedByEmail) && (
                            <div className="mt-2 flex min-w-0 items-start gap-2">
                              <span className="mt-0.5 shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-600">
                                Modifié
                              </span>
                              <div className="min-w-0">
                                <p className="break-words text-xs font-black text-violet-700">
                                  {auditUserLabel(item, "updatedBy")}
                                </p>
                                <p className="mt-0.5 text-[11px] font-semibold text-violet-400">
                                  {new Date(item.lastEditedAt || item.updatedAt).toLocaleTimeString(
                                    "fr-FR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 p-4 text-white shadow-lg">
                    <p className="text-xs font-black uppercase tracking-wider text-blue-200">
                      Total journée
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Quantité
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {formatNumber(totalLitres)} L
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Montant
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {formatMoney(totalPrix)} DH
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

              <div className="hidden w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:block">
                <table className="w-full table-fixed">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      <th className="w-[9%] px-3 py-4">
                        Date
                      </th>

                      <th className="w-[9%] px-3 py-4">
                        N° Bon
                      </th>

                      <th className="w-[8%] px-3 py-4">
                        Autocar
                      </th>

                      <th className="w-[18%] px-3 py-4">
                        Départ
                      </th>

                      <th className="w-[9%] px-3 py-4">
                        Quantité
                      </th>

                      <th className="w-[11%] px-3 py-4">
                        Prix total
                      </th>

                      <th className="w-[8%] px-3 py-4">
                        Photo
                      </th>

                      <th className="w-[18%] px-3 py-4">
                        Traçabilité
                      </th>

                      <th className="w-[8%] px-3 py-4 text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map(
                      (item) => (
                        <tr
                          key={item._id}
                          className="align-middle transition hover:bg-blue-50/40"
                        >
                          <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-slate-600">
                            {formatDate(
                              item.date
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-black text-amber-700">
                              {
                                item.numeroBon
                              }
                            </span>
                          </td>

                          <td className="px-3 py-4">
                            <span className="inline-flex rounded-xl bg-blue-50 px-2.5 py-1.5 text-sm font-black text-blue-700">
                              {
                                item.autocar
                              }
                            </span>
                          </td>

                          <td className="break-words px-3 py-4 text-sm font-bold leading-5">
                            {item.depart}
                          </td>

                          <td className="whitespace-nowrap px-3 py-4">
                            <span className="text-base font-black">
                              {formatNumber(
                                item.quantite
                              )}{" "}
                              L
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-3 py-4 text-base font-black">
                            {formatMoney(
                              item.prixTotal
                            )}{" "}
                            DH
                          </td>

                          <td className="px-3 py-4">
                            {item.imageBon ? (
                              <a
                                href={resolveFileUrl(
                                  item.imageBon
                                )}
                                target="_blank"
                                rel="noreferrer"
                                title="Ouvrir le bon en taille réelle"
                              >
                                <img
                                  src={cloudinaryImageUrl(
                                    item.imageBon,
                                    {
                                      width: 320,
                                      quality:
                                        "auto:eco",
                                    }
                                  )}
                                  alt={`Bon ${item.numeroBon}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-12 w-16 rounded-xl border border-slate-200 object-cover shadow-sm transition hover:scale-105"
                                />
                              </a>
                            ) : (
                              <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                                <ImageIcon
                                  size={20}
                                />
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <div className="space-y-1.5 text-[11px] leading-4">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-blue-600">
                                  Saisi
                                </span>

                                <span
                                  className="min-w-0 truncate font-black text-slate-700"
                                  title={auditUserLabel(
                                    item,
                                    "createdBy"
                                  )}
                                >
                                  {auditUserLabel(
                                    item,
                                    "createdBy"
                                  )}
                                </span>

                                <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                  {item.createdAt
                                    ? new Date(
                                        item.createdAt
                                      ).toLocaleTimeString(
                                        "fr-FR",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "—"}
                                </span>
                              </div>

                              {(item.updatedBy ||
                                item.updatedByName ||
                                item.updatedByMatricule ||
                                item.updatedByEmail) && (
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span className="shrink-0 rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-600">
                                    Modifié
                                  </span>

                                  <span
                                    className="min-w-0 truncate font-black text-violet-700"
                                    title={auditUserLabel(
                                      item,
                                      "updatedBy"
                                    )}
                                  >
                                    {auditUserLabel(
                                      item,
                                      "updatedBy"
                                    )}
                                  </span>

                                  <span className="shrink-0 text-[10px] font-semibold text-violet-400">
                                    {new Date(
                                      item.lastEditedAt ||
                                        item.updatedAt
                                    ).toLocaleTimeString(
                                      "fr-FR",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-2 py-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() =>
                                  openEditForm(
                                    item
                                  )
                                }
                                title="Modifier"
                                className="rounded-lg bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-100"
                              >
                                <Pencil
                                  size={17}
                                />
                              </button>

                              {(["ADMIN", "SUPER_ADMIN"].includes(
                                  authUser.role
                                ) ||
                                String(item.createdBy || "") ===
                                  String(authUser.id || "")) && (
                                <button
                                  onClick={() =>
                                    handleDelete(
                                      item._id
                                    )
                                  }
                                  title="Supprimer"
                                  className="rounded-lg bg-red-50 p-1.5 text-red-500 transition hover:bg-red-100"
                                >
                                  <Trash2
                                    size={17}
                                  />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-50 to-blue-50 font-black">
                      <td
                        colSpan="4"
                        className="px-3 py-4 text-base"
                      >
                        Total journée
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-base text-blue-700">
                        {formatNumber(
                          totalLitres
                        )}{" "}
                        L
                      </td>

                      <td className="whitespace-nowrap px-3 py-4 text-base text-blue-700">
                        {formatMoney(
                          totalPrix
                        )}{" "}
                        DH
                      </td>

                      <td colSpan="3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              </>
            )}
          </section>
        )}

        {page === "resume" && (
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-white bg-white p-6 shadow-xl shadow-slate-200/50">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-400">
                  Répartition du jour
                </p>
                <h3 className="mt-1 text-xl font-black">
                  Quantité par autocar
                </h3>
              </div>

              {autocarChartData.length === 0 ? (
                <EmptyBlock />
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={autocarChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e8edf4"
                    />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="litres"
                      fill="#2563eb"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <ActivityRankingCard
              title="Autocars & départs du jour"
              subtitle="Classement combiné par quantité de gasoil"
              items={topActivities}
            />

            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-7 text-white shadow-xl shadow-blue-200/40 xl:col-span-2">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />

              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-300">
                Résumé du jour
              </p>

              <h3 className="mt-2 text-2xl font-black capitalize">
                {selectedDateLabel}
              </h3>

              <div className="mt-7 grid grid-cols-2 gap-4">
                <MiniStat label="Bons" value={dayRecords.length} />
                <MiniStat
                  label="Litres"
                  value={`${formatNumber(totalLitres)} L`}
                />
                <MiniStat
                  label="Montant"
                  value={`${formatMoney(totalPrix)} DH`}
                />
                <MiniStat
                  label="Solde avance"
                  value={
                    activeAdvance
                      ? `${formatMoney(activeAdvance.solde)} DH`
                      : "—"
                  }
                />
              </div>
            </section>
          </div>
        )}

        {page === "avances" && (
          <AdvancePage
            loading={loadingAvances}
            activeAdvance={activeAdvance}
            advances={avances}
            health={advanceHealth}
            percentUsed={advancePercentUsed}
            remainingPercent={advanceRemainingPercent}
            onNewAdvance={
              canManageUsers
                ? openAdvanceForm
                : null
            }
          />
        )}

        {page === "users" && canManageUsers && (
          <UsersPage
            users={users}
            loading={loadingUsers}
            currentUser={authUser}
            centres={centres}
            onNewUser={openUserForm}
            onEditUser={openEditUserForm}
            onDeleteUser={handleDeleteUser}
          />
        )}

        {page === "centres" && isSuperAdmin && (
          <CentresPage
            centres={centres}
            loading={loadingCentres}
            selectedCentreId={selectedCentreId}
            onSelectCentre={(centreId) => {
              setRecords([]);
              setAvances([]);
              setActiveAdvance(null);
              setSelectedCentreId(
                String(centreId)
              );
              setPage("suivi");
            }}
            onNewCentre={() =>
              openCentreForm()
            }
            onEditCentre={
              openCentreForm
            }
            onDeleteCentre={
              handleDeleteCentre
            }
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-2 px-6 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-xs font-semibold text-slate-400">
            © 2026 Suivi Gasoil Autocar
          </p>

          <p className="text-xs font-bold text-slate-500">
            Noureddine Mohammed · Tous droits réservés
          </p>
        </div>
      </footer>

      {/* CHANGE OWN PASSWORD MODAL */}
      {showPasswordForm && (
        <ModalShell
          title="Changer mon mot de passe"
          eyebrow="Sécurité du compte"
          onClose={closePasswordForm}
        >
          <form
            onSubmit={handlePasswordSubmit}
            className="p-7"
          >
            <div className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-200">
                  <KeyRound size={20} />
                </div>

                <div>
                  <p className="font-black text-slate-900">
                    Sécuriser votre compte
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Saisissez votre mot de passe actuel, puis choisissez un nouveau mot de passe d'au moins 6 caractères.
                  </p>
                </div>
              </div>
            </div>

            {passwordError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {passwordError}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Mot de passe actuel
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Votre mot de passe actuel"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Minimum 6 caractères"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  placeholder="Répétez le nouveau mot de passe"
                />
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closePasswordForm}
                disabled={savingPassword}
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
              >
                <KeyRound size={18} />
                {savingPassword
                  ? "Modification..."
                  : "Changer le mot de passe"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* USER MODAL */}
      {showUserForm && canManageUsers && (
        <ModalShell
          title={
            editingUser
              ? "Modifier l'utilisateur"
              : "Nouveau compte"
          }
          eyebrow={
            editingUser
              ? "Modification des accès"
              : "Administration des accès"
          }
          onClose={closeUserForm}
        >
          <form
            onSubmit={handleSaveUser}
            className="p-7"
          >
            <div className="mb-6 rounded-2xl border border-violet-100 bg-violet-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                  <ShieldCheck size={19} />
                </div>

                <div>
                  <p className="font-black text-violet-950">
                    {userForm.role === "SUPER_ADMIN"
                      ? "Compte super administrateur"
                      : userForm.role === "ADMIN"
                      ? "Compte administrateur"
                      : "Compte utilisateur"}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-violet-700">
                    {userForm.role === "SUPER_ADMIN"
                      ? "Ce compte aura accès à tous les centres, à la gestion des centres et à tous les utilisateurs."
                      : userForm.role === "ADMIN"
                      ? "Cet administrateur gérera les utilisateurs, les avances et les bons de son centre."
                      : "Cet utilisateur travaillera uniquement dans son centre et ne pourra supprimer que ses propres bons."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Matricule"
                name="matricule"
                placeholder="Ex : 5581"
                value={userForm.matricule}
                onChange={handleUserFormChange}
              />

              <Field
                label="Nom (optionnel)"
                name="name"
                placeholder="Ex : Mohamed"
                value={userForm.name}
                onChange={handleUserFormChange}
                required={false}
              />

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Rôle
                </label>

                <select
                  name="role"
                  value={userForm.role}
                  onChange={handleUserFormChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                >
                  <option value="USER">
                    USER — Utilisateur
                  </option>
                  <option value="ADMIN">
                    ADMIN — Administrateur
                  </option>
                  {isSuperAdmin && (
                    <option value="SUPER_ADMIN">
                      SUPER_ADMIN — Tous les centres
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Centre
                </label>

                <select
                  name="centre"
                  value={userForm.centre}
                  onChange={handleUserFormChange}
                  disabled={!isSuperAdmin}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">
                    Sélectionner un centre
                  </option>

                  {centres
                    .filter(
                      (centre) =>
                        centre.active !== false
                    )
                    .map(
                      (centre) => (
                        <option
                          key={centre.id}
                          value={centre.id}
                        >
                          {centre.name} ({centre.code})
                        </option>
                      )
                    )}
                </select>
              </div>

              <div className="md:col-span-2">
                <Field
                  label={
                    editingUser
                      ? "Nouveau mot de passe (optionnel)"
                      : "Mot de passe"
                  }
                  type="password"
                  name="password"
                  placeholder={
                    editingUser
                      ? "Laisser vide pour conserver l'actuel"
                      : "Minimum 6 caractères"
                  }
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  required={!editingUser}
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closeUserForm}
                className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={savingUser}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3 font-bold text-white shadow-lg shadow-violet-200 disabled:opacity-50"
              >
                <UserPlus size={18} />

                {savingUser
                  ? editingUser
                    ? "Modification..."
                    : "Création..."
                  : editingUser
                  ? "Enregistrer les modifications"
                  : "Créer le compte"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* CENTRE MODAL */}
      {showCentreForm && isSuperAdmin && (
        <ModalShell
          title={
            editingCentre
              ? "Modifier le centre"
              : "Nouveau centre"
          }
          eyebrow="Administration multi-centre"
          onClose={closeCentreForm}
        >
          <form
            onSubmit={handleSaveCentre}
            className="p-7"
          >
            <div className="mb-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-blue-900 text-white">
                  <Landmark size={20} />
                </div>

                <div>
                  <p className="font-black text-slate-950">
                    Centre d'exploitation
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Chaque centre possède ses propres bons, avances, utilisateurs et statistiques.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Nom du centre"
                name="name"
                placeholder="Ex : Casablanca"
                value={centreForm.name}
                onChange={handleCentreFormChange}
              />

              <Field
                label="Code"
                name="code"
                placeholder="Ex : CAS"
                value={centreForm.code}
                onChange={handleCentreFormChange}
              />

              {editingCentre && (
                <label className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <p className="font-black text-slate-800">
                      Centre actif
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Un centre désactivé n'est plus disponible pour les utilisateurs.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    name="active"
                    checked={centreForm.active}
                    onChange={handleCentreFormChange}
                    className="h-5 w-5 rounded border-slate-300"
                  />
                </label>
              )}
            </div>

            <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closeCentreForm}
                className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={savingCentre}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-blue-900 px-7 py-3 font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                <Landmark size={18} />
                {savingCentre
                  ? "Enregistrement..."
                  : editingCentre
                  ? "Enregistrer"
                  : "Créer le centre"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* GASOIL MODAL */}
      {showForm && (
        <ModalShell
          title={editingRecord ? "Modifier le bon" : "Ajouter un nouveau bon"}
          eyebrow={editingRecord ? "Modification du bon" : "Nouveau bon gasoil"}
          onClose={closeForm}
          wide
        >
          <form onSubmit={handleSubmit} className="p-5 md:p-7">
            {activeAdvance && (
              <div className="mb-5 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                    {editingRecord ? "Bon existant" : "Avance utilisée"}
                  </p>
                  <p className="mt-1 font-black text-blue-950">
                    {editingRecord
                      ? "Modification du bon"
                      : `Chèque ${activeAdvance.numeroCheque}`}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-blue-500">
                    Prix unitaire du bon
                  </p>
                  <p className="mt-1 text-lg font-black text-blue-950">
                    {form.prixUnitaire
                      ? `${formatMoney(form.prixUnitaire)} DH/L`
                      : "À saisir"}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-xs font-semibold text-blue-500">
                    Solde disponible
                  </p>
                  <p className="mt-1 text-lg font-black text-blue-950">
                    {formatMoney(activeAdvance.solde)} DH
                  </p>
                </div>
              </div>
            )}

            {editingRecord && (
              <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Saisi par
                  </p>
                  <p className="mt-1 font-black text-slate-800">
                    {auditUserLabel(
                      editingRecord,
                      "createdBy"
                    )}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {editingRecord.createdAt
                      ? formatDateTime(
                          editingRecord.createdAt
                        )
                      : "Date inconnue"}
                  </p>
                </div>

                <div className="md:text-right">
                  <p className="text-[11px] font-black uppercase tracking-wider text-violet-500">
                    Dernière modification
                  </p>

                  {editingRecord.updatedBy ||
                  editingRecord.updatedByName ||
                  editingRecord.updatedByMatricule ||
                  editingRecord.updatedByEmail ? (
                    <>
                      <p className="mt-1 font-black text-violet-700">
                        {auditUserLabel(
                          editingRecord,
                          "updatedBy"
                        )}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {formatDateTime(
                          editingRecord.lastEditedAt ||
                            editingRecord.updatedAt
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 font-bold text-slate-500">
                      Jamais modifié
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1280px] w-full border-collapse">
                <thead className="bg-slate-100">
                  <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="border-r border-slate-200 px-3 py-3">Date</th>
                    <th className="border-r border-slate-200 px-3 py-3">N° Bon</th>
                    <th className="border-r border-slate-200 px-3 py-3">Autocar</th>
                    <th className="border-r border-slate-200 px-3 py-3">Départ</th>
                    <th className="border-r border-slate-200 px-3 py-3">Quantité (L)</th>
                    <th className="border-r border-slate-200 px-3 py-3">Prix unitaire</th>
                    <th className="px-3 py-3">Prix total</th>
                  </tr>
                </thead>

                <tbody>
                  <tr className="align-top">
                    <td className="border-r border-t border-slate-200 p-2">
                      <input
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        required
                        className="w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </td>

                    <td className="border-r border-t border-slate-200 p-2">
                      <input
                        name="numeroBon"
                        value={form.numeroBon}
                        onChange={handleChange}
                        placeholder="BG-1025"
                        required
                        className="w-full min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </td>

                    <td className="border-r border-t border-slate-200 p-2">
                      <input
                        name="autocar"
                        value={form.autocar}
                        onChange={handleChange}
                        placeholder="5581"
                        required
                        className="w-full min-w-28 rounded-lg border border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </td>

                    <td className="border-r border-t border-slate-200 p-2">
                      <input
                        name="depart"
                        value={form.depart}
                        onChange={handleChange}
                        placeholder="Marrakech → Laâyoune"
                        required
                        className="w-full min-w-64 rounded-lg border border-slate-200 bg-white px-3 py-3 font-semibold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </td>

                    <td className="border-r border-t border-slate-200 p-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="quantite"
                        value={form.quantite}
                        onChange={handleChange}
                        placeholder="350"
                        required
                        className="w-full min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-3 font-black outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />
                    </td>

                    <td className="border-r border-t border-slate-200 p-2">
                      <div className="min-w-36">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="prixUnitaire"
                          value={form.prixUnitaire}
                          onChange={handleChange}
                          placeholder="16,37"
                          required
                          className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 font-black text-blue-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                        />
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          DH/L · modifiable
                        </p>
                      </div>
                    </td>

                    <td className="border-t border-slate-200 p-2">
                      <div className="min-w-40">
                        <input
                          type="number"
                          step="0.01"
                          name="prixTotal"
                          value={form.prixTotal}
                          readOnly
                          placeholder="Calcul automatique"
                          className="w-full rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3 font-black text-emerald-800 outline-none"
                        />
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">
                          Quantité × {form.prixUnitaire
                            ? formatMoney(form.prixUnitaire)
                            : "—"} DH
                        </p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <UploadField
                label="Photo du bon"
                helper="JPG, PNG ou WEBP"
                preview={preview}
                onChange={handleImage}
              />

              <label>
                <span className="mb-2 block text-sm font-bold text-slate-600">
                  Observation
                </span>

                <textarea
                  name="observation"
                  rows="6"
                  value={form.observation}
                  onChange={handleChange}
                  placeholder="Optionnel..."
                  className="h-full min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                Prix total calculé automatiquement :{" "}
                <span className="font-black text-blue-700">
                  Quantité × Prix unitaire
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 font-bold text-white shadow-lg shadow-blue-200 disabled:opacity-50"
                >
                  {saving
                    ? "Enregistrement..."
                    : editingRecord
                    ? "Enregistrer les modifications"
                    : "Enregistrer le bon"}
                </button>
              </div>
            </div>
          </form>
        </ModalShell>
      )}

      {/* ADVANCE MODAL */}
      {showAdvanceForm && (
        <ModalShell
          title="Nouvelle avance station"
          eyebrow="Nouveau chèque d'avance"
          onClose={closeAdvanceForm}
          green
        >
          <form onSubmit={handleAdvanceSubmit} className="p-7">
            {activeAdvance && Number(activeAdvance.solde || 0) > 0 && (
              <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                <div>
                  <p className="font-black">Une avance est encore active</p>
                  <p className="mt-1 text-sm">
                    Solde restant : {formatMoney(activeAdvance.solde)} DH.
                    Enregistrer un nouveau chèque clôturera l'avance actuelle.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="Date"
                type="date"
                name="date"
                value={advanceForm.date}
                onChange={handleAdvanceChange}
              />

              <Field
                label="Montant avance (DH)"
                type="number"
                step="0.01"
                name="montant"
                placeholder="300000"
                value={advanceForm.montant}
                onChange={handleAdvanceChange}
              />

              <Field
                label="N° Chèque"
                name="numeroCheque"
                placeholder="Ex : CHQ-001"
                value={advanceForm.numeroCheque}
                onChange={handleAdvanceChange}
              />

              <Field
                label="Station"
                name="station"
                placeholder="Ex : Station Afriquia"
                value={advanceForm.station}
                onChange={handleAdvanceChange}
              />

              <div className="md:col-span-2">
                <Field
                  label="Banque"
                  name="banque"
                  placeholder="Ex : Bank of Africa"
                  value={advanceForm.banque}
                  onChange={handleAdvanceChange}
                  required={false}
                />
              </div>

              <UploadField
                label="Photo du chèque"
                helper="Photo ou scan du chèque d'avance"
                preview={advancePreview}
                onChange={handleAdvanceImage}
              />

              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-600">
                  Observation
                </span>

                <textarea
                  name="observation"
                  rows="3"
                  value={advanceForm.observation}
                  onChange={handleAdvanceChange}
                  placeholder="Optionnel..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="mt-7 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closeAdvanceForm}
                className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={savingAdvance}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3 font-bold text-white shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {savingAdvance ? "Enregistrement..." : "Enregistrer l'avance"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

// ===========================================================
// AUTHENTICATION UI
// ===========================================================

function AuthSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_34%)]" />

      <div className="relative flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-2xl shadow-blue-900/50">
          <BusFront size={38} />
        </div>

        <p className="mt-6 text-xl font-black text-white">
          Suivi Gasoil Autocar
        </p>

        <div className="mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
        </div>

        <p className="mt-3 text-sm font-medium text-slate-400">
          Vérification de la session...
        </p>
      </div>
    </div>
  );
}

function AuthScreen({
  setupRequired,
  onAuthenticated,
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    identifier: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isSetup = setupRequired;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      isSetup &&
      form.password !== form.confirmPassword
    ) {
      setError(
        "Les deux mots de passe ne correspondent pas."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const endpoint = isSetup
        ? `${AUTH_API}/setup`
        : `${AUTH_API}/login`;

      const payload = isSetup
        ? {
            name: form.name,
            email: form.email,
            password: form.password,
          }
        : {
            identifier:
              form.identifier,
            password:
              form.password,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Authentification impossible."
        );
      }

      onAuthenticated(
        data.user,
        data.token
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07101f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,_rgba(37,99,235,0.30),_transparent_28%),radial-gradient(circle_at_84%_82%,_rgba(16,185,129,0.18),_transparent_26%),linear-gradient(135deg,_#07101f_0%,_#0b1730_48%,_#0a1020_100%)]" />

      <div className="absolute left-[8%] top-[12%] h-64 w-64 rounded-full border border-blue-400/10 bg-blue-500/5 blur-sm" />
      <div className="absolute bottom-[8%] right-[9%] h-80 w-80 rounded-full border border-emerald-400/10 bg-emerald-400/5 blur-sm" />

      <div className="relative mx-auto grid min-h-screen max-w-[1450px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 shadow-xl shadow-blue-950/40">
              <BusFront size={28} />
            </div>

            <div>
              <p className="text-lg font-black">
                Suivi Gasoil Autocar
              </p>
              <p className="text-sm font-medium text-slate-400">
                Gestion sécurisée des bons et avances
              </p>
            </div>
          </div>

          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-400/10 px-4 py-2 text-sm font-bold text-blue-200">
              <ShieldCheck size={17} />
              Espace sécurisé
            </div>

            <h1 className="text-5xl font-black leading-[1.04] tracking-tight xl:text-6xl">
              Le suivi gasoil,
              <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
                sous contrôle.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">
              Accédez à vos bons quotidiens, au solde des avances station et à
              l'historique depuis un espace protégé.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              <AuthFeature
                icon={<Fuel size={19} />}
                value="Bons"
                label="Suivi quotidien"
              />
              <AuthFeature
                icon={<CreditCard size={19} />}
                value="Avances"
                label="Solde en direct"
              />
              <AuthFeature
                icon={<ShieldCheck size={19} />}
                value="Privé"
                label="Accès protégé"
              />
            </div>
          </div>

          <p className="text-xs font-medium text-slate-600">
            SUIVI GASOIL AUTOCAR · APPLICATION LOCALE
          </p>

          <p className="mt-2 text-xs font-bold text-slate-500">
            Noureddine Mohammed · Tous droits réservés
          </p>
        </section>

        <section className="flex min-h-screen items-center justify-center p-5 sm:p-8 lg:p-12">
          <div className="w-full max-w-[510px]">
            <div className="mb-8 flex items-center gap-4 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 shadow-lg shadow-blue-950/30">
                <BusFront size={24} />
              </div>

              <div>
                <p className="font-black">
                  Suivi Gasoil Autocar
                </p>
                <p className="text-xs text-slate-400">
                  Espace sécurisé
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/30 backdrop-blur-2xl">
              <div className="border-b border-white/10 px-7 py-7 sm:px-9">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-blue-200">
                  <LockKeyhole size={23} />
                </div>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.22em] text-blue-300">
                  {isSetup
                    ? "Première configuration"
                    : "Authentification"}
                </p>

                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  {isSetup
                    ? "Créer le compte administrateur"
                    : "Bienvenue"}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {isSetup
                    ? "Créez le premier compte qui protégera l'accès à l'application."
                    : "Connectez-vous avec votre matricule ou votre e-mail administrateur."}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="px-7 py-7 sm:px-9 sm:py-8"
              >
                {error && (
                  <div className="mb-5 flex gap-3 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-semibold text-red-200">
                    <AlertTriangle
                      className="mt-0.5 shrink-0"
                      size={18}
                    />
                    <span>{error}</span>
                  </div>
                )}

                {isSetup && (
                  <AuthInput
                    icon={<UserRound size={18} />}
                    label="Nom complet"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Votre nom"
                    autoComplete="name"
                  />
                )}

                {isSetup ? (
                  <AuthInput
                    icon={<Mail size={18} />}
                    label="Adresse e-mail administrateur"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="nom@entreprise.com"
                    autoComplete="email"
                  />
                ) : (
                  <AuthInput
                    icon={<UserRound size={18} />}
                    label="Matricule ou e-mail"
                    name="identifier"
                    value={form.identifier}
                    onChange={handleChange}
                    placeholder="Ex : 5581"
                    autoComplete="username"
                  />
                )}

                <div className="mb-5">
                  <label className="mb-2 block text-sm font-bold text-slate-300">
                    Mot de passe
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    />

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      autoComplete={
                        isSetup
                          ? "new-password"
                          : "current-password"
                      }
                      required
                      minLength={6}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-12 font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-white/[0.09] focus:ring-4 focus:ring-blue-500/10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (prev) => !prev
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {isSetup && (
                  <AuthInput
                    icon={<LockKeyhole size={18} />}
                    label="Confirmer le mot de passe"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    name="confirmPassword"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    minLength={6}
                  />
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 px-5 py-4 text-sm font-black text-white shadow-xl shadow-blue-950/30 transition hover:-translate-y-0.5 hover:shadow-blue-900/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldCheck size={19} />
                  {submitting
                    ? "Veuillez patienter..."
                    : isSetup
                    ? "Créer le compte et entrer"
                    : "Se connecter"}
                </button>

                <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
                  <ShieldCheck size={14} />
                  Mot de passe chiffré · Session sécurisée
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AuthInput({
  icon,
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
}) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </span>

      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </div>

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3.5 pl-11 pr-4 font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-blue-400/50 focus:bg-white/[0.09] focus:ring-4 focus:ring-blue-500/10"
        />
      </div>
    </label>
  );
}

function AuthFeature({
  icon,
  value,
  label,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
      <div className="text-blue-300">
        {icon}
      </div>
      <p className="mt-3 text-sm font-black text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {label}
      </p>
    </div>
  );
}

// ===========================================================
// USERS PAGE - ADMIN ONLY
// ===========================================================

function UsersPage({
  users,
  loading,
  currentUser,
  centres,
  onNewUser,
  onEditUser,
  onDeleteUser,
}) {
  const regularUsers =
    users.filter(
      (user) =>
        user.role === "USER"
    );

  const admins =
    users.filter(
      (user) =>
        user.role === "ADMIN"
    );

  const superAdmins =
    users.filter(
      (user) =>
        user.role ===
        "SUPER_ADMIN"
    );

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-400">
            Administration multi-centre
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Utilisateurs
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Affectez chaque compte à un centre et définissez son niveau d'accès.
          </p>
        </div>

        <button
          onClick={onNewUser}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 font-bold text-white shadow-lg shadow-violet-200"
        >
          <UserPlus size={18} />
          Nouveau compte
        </button>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdvanceSummaryCard
          icon={<UsersRound />}
          label="Utilisateurs"
          value={regularUsers.length}
          tone="blue"
        />

        <AdvanceSummaryCard
          icon={<ShieldCheck />}
          label="Administrateurs"
          value={admins.length}
          tone="violet"
        />

        <AdvanceSummaryCard
          icon={<Landmark />}
          label="Super admins"
          value={superAdmins.length}
          tone="emerald"
        />

        <AdvanceSummaryCard
          icon={<Landmark />}
          label="Centres visibles"
          value={centres.length}
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-white bg-white shadow-xl shadow-slate-200/60">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
            <UsersRound size={21} />
          </div>

          <div>
            <h3 className="text-xl font-black">
              Comptes utilisateurs
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Les mots de passe ne sont jamais affichés.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400">
            Chargement...
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            Aucun utilisateur.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">
                    Matricule
                  </th>
                  <th className="px-6 py-4">
                    Nom
                  </th>
                  <th className="px-6 py-4">
                    Centre
                  </th>
                  <th className="px-6 py-4">
                    Rôle
                  </th>
                  <th className="px-6 py-4">
                    Créé le
                  </th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map(
                  (user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-6 py-5">
                        <span
                          className={`rounded-lg px-3 py-2 font-black ${
                            user.role ===
                            "SUPER_ADMIN"
                              ? "bg-slate-900 text-white"
                              : user.role ===
                                "ADMIN"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {user.matricule ||
                            "—"}
                        </span>
                      </td>

                      <td className="px-6 py-5 font-bold">
                        {user.name || "—"}
                      </td>

                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
                          <Landmark
                            size={14}
                            className="text-blue-600"
                          />
                          <span className="text-sm font-black text-slate-700">
                            {user.centre?.name ||
                              "—"}
                          </span>
                          {user.centre?.code && (
                            <span className="text-[10px] font-black text-slate-400">
                              {user.centre.code}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`rounded-full px-3 py-1.5 text-xs font-black ${
                            user.role ===
                            "SUPER_ADMIN"
                              ? "bg-slate-900 text-white"
                              : user.role ===
                                "ADMIN"
                              ? "bg-violet-50 text-violet-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm font-semibold text-slate-500">
                        {formatDate(
                          user.createdAt
                        )}
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              onEditUser(user)
                            }
                            title="Modifier"
                            className="rounded-xl bg-blue-50 p-2.5 text-blue-600 transition hover:bg-blue-100"
                          >
                            <Pencil size={17} />
                          </button>

                          {String(user.id) !==
                            String(
                              currentUser?.id
                            ) && (
                            <button
                              onClick={() =>
                                onDeleteUser(
                                  user.id
                                )
                              }
                              title="Supprimer"
                              className="rounded-xl bg-red-50 p-2.5 text-red-500 transition hover:bg-red-100"
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ===========================================================
// CENTRES PAGE - SUPER ADMIN
// ===========================================================

function CentresPage({
  centres,
  loading,
  selectedCentreId,
  onSelectCentre,
  onNewCentre,
  onEditCentre,
  onDeleteCentre,
}) {
  const totalLitres =
    centres.reduce(
      (sum, centre) =>
        sum +
        Number(
          centre.litres || 0
        ),
      0
    );

  const totalMontant =
    centres.reduce(
      (sum, centre) =>
        sum +
        Number(
          centre.montant || 0
        ),
      0
    );

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-400">
            Super administration
          </p>

          <h2 className="mt-1 text-3xl font-black">
            Centres
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Marrakech, Casablanca, Fès, Agadir et tous les futurs centres dans une seule application.
          </p>
        </div>

        <button
          onClick={onNewCentre}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 to-blue-900 px-5 py-3 font-bold text-white shadow-lg shadow-blue-200"
        >
          <Plus size={18} />
          Nouveau centre
        </button>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdvanceSummaryCard
          icon={<Landmark />}
          label="Centres"
          value={centres.length}
          tone="blue"
        />

        <AdvanceSummaryCard
          icon={<UsersRound />}
          label="Utilisateurs"
          value={centres.reduce(
            (sum, centre) =>
              sum +
              Number(
                centre.usersCount ||
                  0
              ),
            0
          )}
          tone="violet"
        />

        <AdvanceSummaryCard
          icon={<Fuel />}
          label="Litres"
          value={`${formatNumber(
            totalLitres
          )} L`}
          tone="emerald"
        />

        <AdvanceSummaryCard
          icon={<Wallet />}
          label="Montant"
          value={`${formatMoney(
            totalMontant
          )} DH`}
          tone="amber"
        />
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-16 text-center text-slate-400 shadow-sm">
          Chargement des centres...
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {centres.map(
            (centre) => {
              const selected =
                String(
                  centre.id
                ) ===
                String(
                  selectedCentreId
                );

              return (
                <section
                  key={centre.id}
                  className={`relative overflow-hidden rounded-3xl border bg-white p-6 shadow-xl shadow-slate-200/50 transition ${
                    selected
                      ? "border-blue-300 ring-4 ring-blue-100"
                      : "border-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 text-white">
                        <Landmark size={22} />
                      </div>

                      <div>
                        <h3 className="text-xl font-black text-slate-900">
                          {centre.name}
                        </h3>
                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-blue-500">
                          {centre.code}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${
                        centre.active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {centre.active
                        ? "ACTIF"
                        : "INACTIF"}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-400">
                        Utilisateurs
                      </p>
                      <p className="mt-1 text-xl font-black">
                        {centre.usersCount ||
                          0}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-4">
                      <p className="text-xs font-bold text-blue-400">
                        Bons
                      </p>
                      <p className="mt-1 text-xl font-black text-blue-800">
                        {centre.bonsCount ||
                          0}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <p className="text-xs font-bold text-emerald-500">
                        Gasoil
                      </p>
                      <p className="mt-1 text-lg font-black text-emerald-800">
                        {formatNumber(
                          centre.litres
                        )}{" "}
                        L
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 p-4">
                      <p className="text-xs font-bold text-violet-500">
                        Montant
                      </p>
                      <p className="mt-1 text-lg font-black text-violet-800">
                        {formatMoney(
                          centre.montant
                        )}{" "}
                        DH
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {centre.active && (
                      <button
                        onClick={() =>
                          onSelectCentre(
                            centre.id
                          )
                        }
                        className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700"
                      >
                        Ouvrir
                      </button>
                    )}

                    <button
                      onClick={() =>
                        onEditCentre(
                          centre
                        )
                      }
                      className="rounded-xl bg-slate-100 p-2.5 text-slate-600 transition hover:bg-slate-200"
                      title="Modifier"
                    >
                      <Pencil size={17} />
                    </button>

                    <button
                      onClick={() =>
                        onDeleteCentre(
                          centre
                        )
                      }
                      className="rounded-xl bg-red-50 p-2.5 text-red-500 transition hover:bg-red-100"
                      title="Supprimer"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </section>
              );
            }
          )}
        </div>
      )}
    </>
  );
}

// ===========================================================
// AVANCE PAGE
// ===========================================================

function AdvancePage({
  loading,
  activeAdvance,
  advances,
  health,
  percentUsed,
  remainingPercent,
  onNewAdvance,
}) {
  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-16 text-center text-slate-400 shadow-sm">
        Chargement des avances...
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-400">
            Gestion des avances
          </p>
          <h2 className="mt-1 text-3xl font-black">Avances station</h2>
          <p className="mt-2 text-sm text-slate-500">
            Chaque bon de gasoil est automatiquement déduit du chèque actif.
          </p>
        </div>

        {onNewAdvance && (
          <button
            onClick={onNewAdvance}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 font-bold text-white shadow-lg shadow-emerald-200"
          >
            <Plus size={18} />
            Nouvelle avance
          </button>
        )}
      </div>

      {!activeAdvance ? (
        <section className="mb-7 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <CreditCard size={30} />
          </div>

          <h3 className="mt-5 text-2xl font-black">Aucune avance active</h3>
          <p className="mx-auto mt-2 max-w-xl text-slate-500">
            Ajoutez le chèque remis à la station. Les prochains bons seront
            ensuite déduits automatiquement de son montant.
          </p>

          {onNewAdvance && (
            <button
              onClick={onNewAdvance}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white"
            >
              + Ajouter la première avance
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="mb-7 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-7 text-white shadow-xl shadow-blue-200/40">
              <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />

              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-300">
                        Avance active
                      </span>
                    </div>

                    <p className="mt-5 text-sm font-semibold text-blue-200">
                      Montant du chèque
                    </p>
                    <p className="mt-1 text-4xl font-black tracking-tight">
                      {formatMoney(activeAdvance.montant)} DH
                    </p>

                    <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                      <span>
                        Chèque :{" "}
                        <strong>{activeAdvance.numeroCheque}</strong>
                      </span>
                      <span>
                        Station : <strong>{activeAdvance.station}</strong>
                      </span>
                      <span>
                        Date : <strong>{formatDate(activeAdvance.date)}</strong>
                      </span>
                    </div>
                  </div>

                  {activeAdvance.imageCheque && (
                    <a
                      href={resolveFileUrl(activeAdvance.imageCheque)}
                      target="_blank"
                      rel="noreferrer"
                      className="group"
                    >
                      <img
                        src={cloudinaryImageUrl(
                          activeAdvance.imageCheque,
                          {
                            width: 640,
                            quality: "auto:eco",
                          }
                        )}
                        alt="Chèque d'avance"
                        className="h-28 w-44 rounded-2xl border border-white/20 object-cover shadow-xl transition group-hover:scale-[1.03]"
                      />
                      <p className="mt-2 text-center text-xs font-semibold text-blue-200">
                        Voir le chèque
                      </p>
                    </a>
                  )}
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <DarkStat
                    label="Consommé"
                    value={`${formatMoney(activeAdvance.consomme)} DH`}
                  />
                  <DarkStat
                    label="Solde restant"
                    value={`${formatMoney(activeAdvance.solde)} DH`}
                  />
                  <DarkStat
                    label="Bons associés"
                    value={activeAdvance.nombreBons || 0}
                  />
                </div>

                <div className="mt-7">
                  <div className="mb-2 flex justify-between text-sm font-bold">
                    <span>Utilisation</span>
                    <span>{formatNumber(percentUsed)} %</span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <AdvanceHealthCard
              health={health}
              remainingPercent={remainingPercent}
              activeAdvance={activeAdvance}
            />
          </div>

          <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdvanceSummaryCard
              icon={<CircleDollarSign />}
              label="Avance initiale"
              value={`${formatMoney(activeAdvance.montant)} DH`}
              tone="blue"
            />
            <AdvanceSummaryCard
              icon={<Wallet />}
              label="Montant consommé"
              value={`${formatMoney(activeAdvance.consomme)} DH`}
              tone="violet"
            />
            <AdvanceSummaryCard
              icon={<Landmark />}
              label="Solde disponible"
              value={`${formatMoney(activeAdvance.solde)} DH`}
              tone="emerald"
            />
            <AdvanceSummaryCard
              icon={<Fuel />}
              label="Litres associés"
              value={`${formatNumber(activeAdvance.litres)} L`}
              tone="amber"
            />
          </div>
        </>
      )}

      <section className="overflow-hidden rounded-3xl border border-white bg-white shadow-xl shadow-slate-200/60">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <History size={20} />
          </div>

          <div>
            <h3 className="text-xl font-black">Historique des avances</h3>
            <p className="mt-1 text-sm text-slate-500">
              Tous les chèques d'avance enregistrés
            </p>
          </div>
        </div>

        {advances.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            Aucune avance enregistrée.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">N° Chèque</th>
                  <th className="px-6 py-4">Station</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Consommé</th>
                  <th className="px-6 py-4">Solde</th>
                  <th className="px-6 py-4">Bons</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Photo</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {advances.map((avance) => (
                  <tr key={avance._id} className="hover:bg-slate-50">
                    <td className="px-6 py-5 font-semibold">
                      {formatDate(avance.date)}
                    </td>
                    <td className="px-6 py-5 font-black">
                      {avance.numeroCheque}
                    </td>
                    <td className="px-6 py-5">{avance.station}</td>
                    <td className="px-6 py-5 font-bold">
                      {formatMoney(avance.montant)} DH
                    </td>
                    <td className="px-6 py-5">
                      {formatMoney(avance.consomme)} DH
                    </td>
                    <td className="px-6 py-5 font-black text-blue-700">
                      {formatMoney(avance.solde)} DH
                    </td>
                    <td className="px-6 py-5">{avance.nombreBons || 0}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-black ${
                          avance.statut === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {avance.statut === "ACTIVE" ? "ACTIVE" : "CLÔTURÉE"}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {avance.imageCheque ? (
                        <a
                          href={resolveFileUrl(avance.imageCheque)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={cloudinaryImageUrl(
                              avance.imageCheque,
                              {
                                width: 480,
                                quality: "auto:eco",
                              }
                            )}
                            alt={`Chèque ${avance.numeroCheque}`}
                            className="h-12 w-20 rounded-lg border border-slate-200 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ===========================================================
// COMPONENTS
// ===========================================================

function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-bold transition xl:px-4 ${
        active
          ? "bg-white text-blue-700 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function CompactAdvanceStatus({ activeAdvance, health, onOpen }) {
  if (!activeAdvance) {
    return (
      <button
        onClick={onOpen}
        className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-amber-600" size={22} />
          <div>
            <p className="font-black text-amber-900">
              Aucune avance station active
            </p>
            <p className="text-sm text-amber-700">
              Ajoutez le chèque d'avance avant d'enregistrer un bon.
            </p>
          </div>
        </div>

        <span className="font-black text-amber-800">Configurer →</span>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition hover:border-blue-200"
    >
      <div className="flex items-center gap-3">
        <CreditCard className="text-blue-600" size={22} />
        <div>
          <p className="font-black">
            Avance active — {activeAdvance.numeroCheque}
          </p>
          <p className="text-sm text-slate-500">
            {health.label} · {activeAdvance.station}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="text-xs font-semibold text-slate-400">Solde restant</p>
        <p className="text-xl font-black text-blue-700">
          {formatMoney(activeAdvance.solde)} DH
        </p>
      </div>
    </button>
  );
}

function AdvanceHealthCard({ health, remainingPercent, activeAdvance }) {
  const themes = {
    emerald: {
      box: "border-emerald-200 bg-emerald-50",
      icon: "bg-emerald-600 text-white",
      title: "text-emerald-950",
      text: "text-emerald-700",
    },
    amber: {
      box: "border-amber-200 bg-amber-50",
      icon: "bg-amber-500 text-white",
      title: "text-amber-950",
      text: "text-amber-700",
    },
    red: {
      box: "border-red-200 bg-red-50",
      icon: "bg-red-600 text-white",
      title: "text-red-950",
      text: "text-red-700",
    },
    slate: {
      box: "border-slate-200 bg-slate-50",
      icon: "bg-slate-500 text-white",
      title: "text-slate-950",
      text: "text-slate-600",
    },
  };

  const theme = themes[health.tone] || themes.slate;

  return (
    <section className={`rounded-3xl border p-6 shadow-sm ${theme.box}`}>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${theme.icon}`}
      >
        {health.icon}
      </div>

      <p className={`mt-5 text-xl font-black ${theme.title}`}>
        {health.label}
      </p>
      <p className={`mt-2 text-sm ${theme.text}`}>{health.description}</p>

      {activeAdvance && (
        <div className="mt-7 rounded-2xl bg-white/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Solde disponible
          </p>
          <p className="mt-1 text-3xl font-black">
            {formatMoney(activeAdvance.solde)} DH
          </p>
          <p className="mt-2 text-sm font-bold text-slate-500">
            {formatNumber(remainingPercent)} % de l'avance reste disponible
          </p>
        </div>
      )}
    </section>
  );
}

function AdvanceSummaryCard({ icon, label, value, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-white bg-white p-4 shadow-lg shadow-slate-200/50 sm:rounded-3xl sm:p-5">
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          tones[tone] || tones.blue
        }`}
      >
        {icon}
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function DarkStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold text-blue-200">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function ModalShell({ eyebrow, title, onClose, children, green = false, wide = false }) {
  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`mx-auto my-2 w-full overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-6 sm:rounded-3xl md:my-10 ${
          wide ? "max-w-[1500px]" : "max-w-3xl"
        }`}
      >
        <div
          className={`flex items-start justify-between gap-3 px-4 py-4 text-white sm:px-7 sm:py-6 ${
            green
              ? "bg-gradient-to-r from-emerald-950 to-teal-900"
              : "bg-gradient-to-r from-slate-950 to-blue-950"
          }`}
        >
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-[0.18em] ${
                green ? "text-emerald-300" : "text-blue-300"
              }`}
            >
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-black sm:text-2xl">{title}</h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20"
          >
            <X size={21} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function UploadField({ label, helper, preview, onChange }) {
  return (
    <div className="md:col-span-2">
      <p className="mb-2 text-sm font-bold text-slate-600">{label}</p>

      <div className="relative flex min-h-32 items-center gap-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/50 px-6 py-6 transition hover:border-blue-400">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Camera size={24} />
        </div>

        <div>
          <p className="font-black">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onChange}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>

      {preview && (
        <img
          src={preview}
          alt="Aperçu"
          className="mt-4 h-56 w-full rounded-2xl border border-slate-200 bg-slate-50 object-contain"
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, accent = "blue" }) {
  const themes = {
    blue: "from-blue-500 to-blue-700 shadow-blue-100",
    emerald: "from-emerald-500 to-emerald-700 shadow-emerald-100",
    violet: "from-violet-500 to-indigo-700 shadow-violet-100",
    amber: "from-amber-400 to-orange-600 shadow-orange-100",
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-lg shadow-slate-200/50">
      <div
        className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${themes[accent]}`}
      >
        {icon}
      </div>

      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>

      <div className="absolute -bottom-10 -right-10 h-28 w-28 rounded-full bg-blue-50 opacity-70 transition duration-300 group-hover:scale-125" />
    </div>
  );
}

function ActivityRankingCard({ title, subtitle, items }) {
  return (
    <section className="rounded-3xl border border-white bg-white p-6 shadow-xl shadow-slate-200/50">
      <div className="mb-6">
        <h3 className="text-xl font-black">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <EmptyBlock />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.autocar}-${item.depart}`}
              className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-slate-50 p-4 transition hover:bg-blue-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-black text-white">
                {index + 1}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-sm font-black text-blue-700">
                    Autocar {item.autocar}
                  </span>

                  <span className="truncate font-black text-slate-900">
                    {item.depart}
                  </span>
                </div>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {formatMoney(item.montant)} DH
                </p>
              </div>

              <p className="whitespace-nowrap text-lg font-black text-blue-700">
                {formatNumber(item.litres)} L
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold text-blue-200">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center p-12 text-center text-slate-400">
      <Fuel size={38} className="mb-3" />
      <p className="font-bold">Aucune donnée pour cette journée</p>
    </div>
  );
}

function Field({
  label,
  type = "text",
  name,
  value,
  onChange,
  placeholder,
  step,
  readOnly,
  required = true,
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-slate-600">
        {label}
      </span>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step={step}
        readOnly={readOnly}
        required={required}
        className={`w-full rounded-xl border px-4 py-3 outline-none transition ${
          readOnly
            ? "border-slate-200 bg-slate-100 font-black text-blue-700"
            : "border-slate-200 bg-slate-50 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
        }`}
      />
    </label>
  );
}

export default App;
