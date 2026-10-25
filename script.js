/* ============================================================
   script.js – DailyNote App Logic
   
   Daftar fungsi utama:
   - loadData()         : Ambil semua data dari LocalStorage
   - saveData()         : Simpan semua data ke LocalStorage
   - addTask()          : Tambah task baru
   - deleteTask()       : Hapus task
   - toggleTask()       : Tandai task selesai/belum selesai
   - renderTasks()      : Tampilkan task ke halaman
   - updateProgress()   : Hitung dan update progress bar
   - saveJournal()      : Simpan refleksi harian
   - loadJournal()      : Tampilkan refleksi yang sudah tersimpan
   - renderHistory()    : Tampilkan halaman History
   - showToast()        : Tampilkan notifikasi kecil
   - navigateTo()       : Pindah antar halaman
   ============================================================ */

/* ============================================================
   KONSTANTA & VARIABEL GLOBAL
   ============================================================ */

// Key yang digunakan untuk menyimpan data di LocalStorage
const STORAGE_KEY_TASKS    = 'dailynote_tasks';
const STORAGE_KEY_JOURNAL  = 'dailynote_journals';
const STORAGE_KEY_SETTINGS = 'dailynote_settings';

// Variabel global untuk menyimpan state aplikasi
let tasks    = [];  // Array berisi semua task hari ini
let journals = {};  // Object berisi semua journal, key = tanggal (YYYY-MM-DD)
let settings = {    // Object berisi pengaturan aplikasi
    userName: 'Afkar',
    theme: 'light',
    reminder: false,
    rollover: false
};

let selectedMood    = '';    // Mood yang dipilih user
let pendingDeleteId = null;  // ID task yang akan dihapus (untuk confirm modal)
let confirmCallback = null;  // Fungsi yang dipanggil saat konfirmasi diterima

// Tanggal hari ini dalam format YYYY-MM-DD (digunakan sebagai key data)
const TODAY = getTodayString();

/* ============================================================
   UTILITAS TANGGAL
   ============================================================ */

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD
 * Contoh: "2026-10-23"
 */
function getTodayString() {
    const now = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // +1 karena bulan mulai dari 0
    const day   = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format tanggal menjadi tulisan yang mudah dibaca
 * Contoh: "2026-10-23" → "Friday, October 23"
 */
function formatDateDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00'); // Tambah T00:00:00 agar tidak salah zona waktu
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Menentukan sapaan berdasarkan waktu
 * Pagi (5-11), Siang (12-16), Malam (17-4)
 */
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12)  return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    return 'Good Evening';
}

/* ============================================================
   LOCALSTORAGE – SIMPAN & AMBIL DATA
   ============================================================ */

/**
 * loadData() – Ambil semua data tersimpan dari LocalStorage
 * Dipanggil sekali saat aplikasi pertama kali dibuka
 */
function loadData() {
    // Ambil tasks (hanya task hari ini)
    const allTasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || '{}');
    tasks = allTasks[TODAY] || [];

    // Ambil semua journal
    journals = JSON.parse(localStorage.getItem(STORAGE_KEY_JOURNAL) || '{}');

    // Ambil settings
    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    settings = { ...settings, ...savedSettings }; // Gabungkan dengan default
}

/**
 * saveTasks() – Simpan tasks ke LocalStorage
 * Dipanggil setiap kali ada perubahan pada tasks
 */
function saveTasks() {
    // Ambil semua tasks yang sudah ada (termasuk hari lain)
    const allTasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || '{}');
    allTasks[TODAY] = tasks; // Timpa tasks hari ini
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(allTasks));
}

/**
 * saveJournalData() – Simpan semua journal ke LocalStorage
 */
function saveJournalData() {
    localStorage.setItem(STORAGE_KEY_JOURNAL, JSON.stringify(journals));
}

/**
 * saveSettings() – Simpan settings ke LocalStorage
 */
function saveSettings() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

/* ============================================================
   TASK FUNCTIONS
   ============================================================ */

/**
 * addTask(title, category) – Tambah task baru ke array dan simpan
 * 
 * Parameter:
 *   title    : string – nama task
 *   category : string – kategori task (Academic, Work, dll)
 */
function addTask(title, category) {
    // Buat object task baru
    const newTask = {
        id: Date.now(), // ID unik menggunakan timestamp
        title: title.trim(),
        category: category || 'Other',
        completed: false,
        date: TODAY
    };

    tasks.push(newTask); // Tambah ke array
    saveTasks();         // Simpan ke LocalStorage
    renderTasks();       // Tampilkan ke halaman
    updateProgress();    // Perbarui progress bar
}

/**
 * deleteTask(id) – Hapus task berdasarkan ID
 * 
 * Parameter:
 *   id : number – ID task yang akan dihapus
 */
function deleteTask(id) {
    // Filter: buat array baru tanpa task yang ID-nya cocok
    tasks = tasks.filter(function(task) {
        return task.id !== id;
    });

    saveTasks();
    renderTasks();
    updateProgress();
    showToast('Task deleted.', 'danger');
}

/**
 * toggleTask(id) – Toggle status selesai/belum selesai task
 * 
 * Parameter:
 *   id : number – ID task yang akan di-toggle
 */
function toggleTask(id) {
    // Cari task dengan ID yang cocok lalu balik nilai completed-nya
    tasks = tasks.map(function(task) {
        if (task.id === id) {
            return { ...task, completed: !task.completed };
        }
        return task;
    });

    saveTasks();
    renderTasks();
    updateProgress();
}

/**
 * renderTasks() – Render semua task ke dalam HTML
 * Fungsi ini menghapus semua task yang ditampilkan lalu menggambarnya ulang
 */
function renderTasks() {
    const taskList       = document.getElementById('task-list');
    const emptyState     = document.getElementById('tasks-empty-state');
    const taskCountBadge = document.getElementById('task-count-badge');

    // Kosongkan list dulu
    taskList.innerHTML = '';

    // Update badge jumlah task
    taskCountBadge.textContent = tasks.length;

    // Tampilkan empty state jika tidak ada task
    if (tasks.length === 0) {
        emptyState.style.display = 'flex';
        return;
    } else {
        emptyState.style.display = 'none';
    }

    // Urutkan: task yang belum selesai di atas
    const sortedTasks = [...tasks].sort(function(a, b) {
        return a.completed - b.completed;
    });

    // Buat elemen HTML untuk setiap task
    sortedTasks.forEach(function(task) {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' completed' : '');
        li.setAttribute('data-id', task.id);

        // Tentukan class kategori untuk warna badge
        const catClass = 'cat-' + task.category.replace(/\s+/g, '');

        li.innerHTML = `
            <div class="task-checkbox" onclick="toggleTask(${task.id})" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
            <div class="task-body">
                <p class="task-title">${escapeHTML(task.title)}</p>
                <span class="task-category ${catClass}">${task.category}</span>
            </div>
            <button class="task-delete-btn" onclick="confirmDelete(${task.id})" title="Delete task" aria-label="Delete task">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
            </button>
        `;

        taskList.appendChild(li);
    });
}

/* ============================================================
   PROGRESS FUNCTIONS
   ============================================================ */

/**
 * updateProgress() – Hitung dan perbarui tampilan progress
 * Dipanggil setiap kali task berubah
 */
function updateProgress() {
    const total     = tasks.length;
    const completed = tasks.filter(function(t) { return t.completed; }).length;

    // Hitung persentase (hindari pembagian dengan 0)
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Update elemen-elemen di halaman
    document.getElementById('progress-badge').textContent   = percent + '%';
    document.getElementById('progress-subtitle').textContent = `${completed} of ${total} task${total !== 1 ? 's' : ''} completed`;
    document.getElementById('progress-bar-fill').style.width = percent + '%';

    // Update ARIA attribute untuk aksesibilitas
    document.querySelector('.progress-bar-wrap').setAttribute('aria-valuenow', percent);

    // Pesan motivasi berdasarkan persentase
    document.getElementById('progress-motivation').textContent = getMotivationMessage(percent, total);
}

/**
 * getMotivationMessage(percent, total) – Kembalikan pesan motivasi
 * berdasarkan persentase progress
 */
function getMotivationMessage(percent, total) {
    if (total === 0)     return 'Add your first task to get started! ✨';
    if (percent === 0)   return "Let's get started! You've got this. 💪";
    if (percent < 25)    return 'Good start! Keep going! 🚀';
    if (percent < 50)    return 'Making progress, keep it up! 📈';
    if (percent === 50)  return 'Halfway there, steady progress. 🌱';
    if (percent < 75)    return 'More than halfway! You\'re doing great! ⭐';
    if (percent < 100)   return 'Almost done! Push through! 🔥';
    return 'All tasks completed! Amazing work today! 🎉';
}

/* ============================================================
   DAILY REFLECTION (JOURNAL) FUNCTIONS
   ============================================================ */

/**
 * saveJournal() – Simpan refleksi harian ke LocalStorage
 * Dipanggil ketika user menekan tombol "Save Note"
 */
function saveJournal() {
    const text = document.getElementById('reflection-text').value.trim();

    // Validasi: minimal mood atau teks harus diisi
    if (!selectedMood && !text) {
        showToast('Please select a mood or write a reflection first.', '');
        return;
    }

    // Buat object journal untuk hari ini
    const journalEntry = {
        date: TODAY,
        mood: selectedMood || '',
        text: text
    };

    journals[TODAY] = journalEntry; // Simpan dengan key tanggal
    saveJournalData();

    // Tampilkan feedback
    const feedback = document.getElementById('save-feedback');
    feedback.textContent = '✓ Reflection saved for today!';
    setTimeout(function() {
        feedback.textContent = '';
    }, 3000);

    showToast('Reflection saved! 📝', 'success');
}

/**
 * loadJournal() – Muat data journal hari ini ke form
 * Dipanggil saat halaman pertama dibuka
 */
function loadJournal() {
    const todayJournal = journals[TODAY];
    if (!todayJournal) return; // Tidak ada journal hari ini

    // Isi textarea
    document.getElementById('reflection-text').value = todayJournal.text || '';
    updateCharCount();

    // Set mood yang dipilih
    if (todayJournal.mood) {
        selectedMood = todayJournal.mood;
        // Highlight tombol mood yang sesuai
        document.querySelectorAll('.mood-btn').forEach(function(btn) {
            if (btn.dataset.mood === todayJournal.mood) {
                btn.classList.add('selected');
            }
        });
    }
}

/**
 * updateCharCount() – Update counter karakter di textarea
 */
function updateCharCount() {
    const text      = document.getElementById('reflection-text').value;
    const charCount = document.getElementById('char-count');
    const charWrap  = document.querySelector('.char-count');

    charCount.textContent = text.length;

    // Ubah warna counter saat mendekati limit
    charWrap.classList.remove('near-limit', 'at-limit');
    if (text.length >= 280)      charWrap.classList.add('at-limit');
    else if (text.length >= 230) charWrap.classList.add('near-limit');
}

/* ============================================================
   HISTORY PAGE
   ============================================================ */

/**
 * renderHistory() – Render semua history ke halaman History
 * Dipanggil setiap kali user membuka halaman History
 */
function renderHistory() {
    const historyList  = document.getElementById('history-list');
    const emptyState   = document.getElementById('history-empty-state');

    historyList.innerHTML = '';

    // Ambil semua tanggal dari tasks dan journals, gabungkan
    const allTasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || '{}');
    const allDates = new Set([
        ...Object.keys(allTasks),
        ...Object.keys(journals)
    ]);

    // Filter: hanya tampilkan hari SEBELUM hari ini
    const pastDates = Array.from(allDates).filter(function(date) {
        return date < TODAY;
    });

    // Urutkan dari yang terbaru ke terlama
    pastDates.sort(function(a, b) {
        return b.localeCompare(a);
    });

    if (pastDates.length === 0) {
        emptyState.style.display = 'flex';
        return;
    } else {
        emptyState.style.display = 'none';
    }

    // Buat card untuk setiap hari
    pastDates.forEach(function(date) {
        const dayTasks   = allTasks[date] || [];
        const dayJournal = journals[date] || null;
        const completed  = dayTasks.filter(function(t) { return t.completed; }).length;
        const total      = dayTasks.length;

        const card = document.createElement('div');
        card.className = 'history-day-card';

        // Header card (bisa diklik untuk expand)
        let headerHTML = `
            <div class="history-day-header" onclick="toggleHistoryCard(this.parentElement)">
                <div>
                    <p class="history-day-date">${formatDateDisplay(date)}</p>
                    <p class="history-day-stats">${completed} of ${total} tasks completed</p>
                </div>
                <svg class="history-day-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
        `;

        // Body card (konten yang tersembunyi)
        let bodyHTML = '<div class="history-day-body">';

        // Daftar task
        if (dayTasks.length > 0) {
            dayTasks.forEach(function(task) {
                bodyHTML += `
                    <div class="history-task-item">
                        <div class="history-task-check ${task.completed ? 'done' : ''}">
                            ${task.completed ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                        </div>
                        <span class="history-task-text ${task.completed ? 'crossed' : ''}">${escapeHTML(task.title)}</span>
                        <span class="task-category cat-${task.category}">${task.category}</span>
                    </div>
                `;
            });
        } else {
            bodyHTML += '<p style="font-size:0.8rem; color: var(--color-text-muted); padding: 8px 0;">No tasks recorded.</p>';
        }

        // Journal section
        if (dayJournal) {
            bodyHTML += `
                <div class="history-journal-section">
                    <p class="history-journal-label">Journal</p>
                    ${dayJournal.mood ? `<span class="history-journal-mood">${dayJournal.mood}</span>` : ''}
                    ${dayJournal.text ? `<p class="history-journal-text">"${escapeHTML(dayJournal.text)}"</p>` : ''}
                </div>
            `;
        }

        bodyHTML += '</div>';

        card.innerHTML = headerHTML + bodyHTML;
        historyList.appendChild(card);
    });
}

/**
 * toggleHistoryCard(card) – Expand/collapse history card
 * Dipanggil saat user mengklik header history card
 */
function toggleHistoryCard(card) {
    card.classList.toggle('open');
}

/* ============================================================
   NAVIGATION
   ============================================================ */

/**
 * navigateTo(pageName) – Pindah ke halaman tertentu
 * 
 * Parameter:
 *   pageName : string – 'today', 'history', atau 'settings'
 */
function navigateTo(pageName) {
    // Sembunyikan semua halaman
    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.remove('active');
    });

    // Hapus active dari semua nav button
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });

    // Tampilkan halaman yang dipilih
    document.getElementById('page-' + pageName).classList.add('active');
    document.getElementById('nav-' + pageName).classList.add('active');

    // Jalankan fungsi khusus saat masuk halaman tertentu
    if (pageName === 'history') {
        renderHistory();
    }
}

/* ============================================================
   MODAL FUNCTIONS
   ============================================================ */

/**
 * openAddTaskModal() – Tampilkan modal tambah task
 */
function openAddTaskModal() {
    document.getElementById('add-task-modal').classList.add('open');
    document.getElementById('task-name-input').focus();
    // Reset form
    document.getElementById('task-name-input').value = '';
    document.getElementById('task-category-select').value = '';
}

/**
 * closeAddTaskModal() – Sembunyikan modal tambah task
 */
function closeAddTaskModal() {
    document.getElementById('add-task-modal').classList.remove('open');
}

/**
 * confirmDelete(taskId) – Tampilkan modal konfirmasi hapus task
 * 
 * Parameter:
 *   taskId : number – ID task yang akan dihapus
 */
function confirmDelete(taskId) {
    pendingDeleteId = taskId;
    document.getElementById('confirm-title').textContent = 'Delete Task?';
    document.getElementById('confirm-text').textContent  = 'Are you sure you want to delete this task? This action cannot be undone.';
    document.getElementById('confirm-modal').classList.add('open');
}

/**
 * closeConfirmModal() – Sembunyikan modal konfirmasi
 */
function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('open');
    pendingDeleteId = null;
    confirmCallback = null;
}

/* ============================================================
   SETTINGS FUNCTIONS
   ============================================================ */

/**
 * applyTheme(theme) – Terapkan tema ke seluruh aplikasi
 * 
 * Parameter:
 *   theme : string – 'light', 'dark', atau 'auto'
 */
function applyTheme(theme) {
    const htmlEl = document.documentElement;

    if (theme === 'auto') {
        // Gunakan preferensi sistem operasi
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        htmlEl.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        htmlEl.setAttribute('data-theme', theme);
    }

    // Update tampilan tombol tema di settings
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    settings.theme = theme;
    saveSettings();
}

/**
 * exportJournal() – Download data journal sebagai file .json
 */
function exportJournal() {
    // Ambil semua data
    const allTasks   = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || '{}');
    const exportData = {
        exportDate : new Date().toISOString(),
        tasks      : allTasks,
        journals   : journals,
        settings   : settings
    };

    // Konversi ke string JSON yang rapi
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob    = new Blob([dataStr], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);

    // Buat link download dan klik otomatis
    const a = document.createElement('a');
    a.href     = url;
    a.download = `dailynote-export-${TODAY}.json`;
    a.click();

    URL.revokeObjectURL(url); // Bersihkan URL objek
    showToast('Journal exported! 📥', 'success');
}

/**
 * clearAllData() – Hapus semua data dari LocalStorage
 * Hanya dipanggil setelah user konfirmasi
 */
function clearAllData() {
    localStorage.removeItem(STORAGE_KEY_TASKS);
    localStorage.removeItem(STORAGE_KEY_JOURNAL);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);

    // Reset variabel
    tasks    = [];
    journals = {};
    settings = { userName: 'Afkar', theme: 'light', reminder: false, rollover: false };

    renderTasks();
    updateProgress();
    applyTheme('light');

    showToast('All data cleared.', 'danger');
}

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */

/**
 * showToast(message, type) – Tampilkan notifikasi kecil di bawah layar
 * 
 * Parameter:
 *   message : string – pesan yang ditampilkan
 *   type    : string – 'success', 'danger', atau '' (default)
 */
function showToast(message, type) {
    const toast = document.getElementById('toast');
    
    // Reset class
    toast.className = 'toast';
    if (type) toast.classList.add(type);

    toast.textContent = message;
    toast.classList.add('show');

    // Sembunyikan setelah 2.5 detik
    setTimeout(function() {
        toast.classList.remove('show');
    }, 2500);
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

/**
 * escapeHTML(str) – Hindari XSS dengan escape karakter HTML
 * Selalu gunakan fungsi ini sebelum memasukkan teks user ke innerHTML
 * 
 * Parameter:
 *   str : string – teks yang akan di-escape
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * updateHeaderInfo() – Perbarui greeting dan tanggal di header
 */
function updateHeaderInfo() {
    const name = settings.userName || 'You';
    document.getElementById('greeting-text').textContent = `${getGreeting()}, ${name} 👋`;
    document.getElementById('greeting-date').textContent = formatDateDisplay(TODAY);
    
    // Update avatar initial
    const initial = name.charAt(0).toUpperCase();
    document.getElementById('avatar-initial').textContent = initial;
}

/* ============================================================
   TASK ROLLOVER FUNCTION
   ============================================================ */

/**
 * handleTaskRollover() – Pindahkan task yang belum selesai ke hari ini
 * Dipanggil saat aplikasi dibuka jika fitur rollover aktif
 */
function handleTaskRollover() {
    if (!settings.rollover) return;

    const allTasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS) || '{}');

    // Cari tanggal kemarin
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yYear  = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay   = String(yesterday.getDate()).padStart(2, '0');
    const yStr   = `${yYear}-${yMonth}-${yDay}`;

    const yesterdayTasks = allTasks[yStr] || [];

    // Ambil task kemarin yang belum selesai
    const incompleteTasks = yesterdayTasks.filter(function(t) {
        return !t.completed;
    });

    if (incompleteTasks.length === 0) return;

    // Tambahkan ke tasks hari ini (dengan ID baru)
    incompleteTasks.forEach(function(t) {
        // Cek apakah task sudah ada di hari ini (hindari duplikat)
        const alreadyExists = tasks.some(function(existing) {
            return existing.title === t.title;
        });
        if (!alreadyExists) {
            tasks.push({
                id       : Date.now() + Math.random(),
                title    : t.title,
                category : t.category,
                completed: false,
                date     : TODAY
            });
        }
    });

    saveTasks();
    showToast(`${incompleteTasks.length} task(s) rolled over from yesterday.`, 'success');
}

/* ============================================================
   EVENT LISTENERS (Setup saat halaman dimuat)
   ============================================================ */

/**
 * Semua event listener dipasang di dalam DOMContentLoaded
 * agar elemen HTML sudah tersedia saat script dijalankan
 */
document.addEventListener('DOMContentLoaded', function() {

    // ---- INISIALISASI ----
    loadData();
    handleTaskRollover();
    renderTasks();
    updateProgress();
    loadJournal();
    updateHeaderInfo();
    applyTheme(settings.theme);

    // Isi field nama di settings
    document.getElementById('user-name-input').value = settings.userName || '';

    // Set toggle sesuai settings
    document.getElementById('reminder-toggle').checked = settings.reminder || false;
    document.getElementById('rollover-toggle').checked = settings.rollover || false;

    // ---- NAVIGASI ----
    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            navigateTo(this.dataset.page);
        });
    });

    // ---- TOMBOL ADD TASK ----
    document.getElementById('add-task-btn').addEventListener('click', openAddTaskModal);

    // ---- MODAL ADD TASK ----
    document.getElementById('modal-close-btn').addEventListener('click', closeAddTaskModal);
    document.getElementById('modal-cancel-btn').addEventListener('click', closeAddTaskModal);

    // Klik di luar modal untuk menutup
    document.getElementById('add-task-modal').addEventListener('click', function(e) {
        if (e.target === this) closeAddTaskModal();
    });

    // Submit form tambah task
    document.getElementById('modal-submit-btn').addEventListener('click', function() {
        const title    = document.getElementById('task-name-input').value.trim();
        const category = document.getElementById('task-category-select').value;

        if (!title) {
            showToast('Please enter a task name.', '');
            document.getElementById('task-name-input').focus();
            return;
        }

        addTask(title, category || 'Other');
        closeAddTaskModal();
        showToast('Task added! ✓', 'success');
    });

    // Tekan Enter di input task name untuk submit
    document.getElementById('task-name-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            document.getElementById('modal-submit-btn').click();
        }
    });

    // ---- MODAL KONFIRMASI HAPUS ----
    document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmModal);

    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) closeConfirmModal();
    });

    document.getElementById('confirm-ok-btn').addEventListener('click', function() {
        if (pendingDeleteId !== null) {
            deleteTask(pendingDeleteId);
        }
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        closeConfirmModal();
    });

    // ---- MOOD SELECTOR ----
    document.querySelectorAll('.mood-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            // Hapus selection dari semua tombol
            document.querySelectorAll('.mood-btn').forEach(function(b) {
                b.classList.remove('selected');
            });

            // Toggle: jika sudah dipilih, batal. Jika belum, pilih
            if (selectedMood === this.dataset.mood) {
                selectedMood = '';
            } else {
                selectedMood = this.dataset.mood;
                this.classList.add('selected');
            }
        });
    });

    // ---- TEXTAREA CHAR COUNT ----
    document.getElementById('reflection-text').addEventListener('input', updateCharCount);

    // ---- SAVE NOTE ----
    document.getElementById('save-note-btn').addEventListener('click', saveJournal);

    // ---- SETTINGS: THEME ----
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            applyTheme(this.dataset.theme);
        });
    });

    // ---- SETTINGS: SAVE NAME ----
    document.getElementById('save-name-btn').addEventListener('click', function() {
        const name = document.getElementById('user-name-input').value.trim();
        if (!name) {
            showToast('Please enter your name.', '');
            return;
        }
        settings.userName = name;
        saveSettings();
        updateHeaderInfo();
        showToast('Name saved! ✓', 'success');
    });

    // ---- SETTINGS: REMINDER TOGGLE ----
    document.getElementById('reminder-toggle').addEventListener('change', function() {
        settings.reminder = this.checked;
        saveSettings();
        showToast(this.checked ? 'Reminder enabled.' : 'Reminder disabled.', '');
    });

    // ---- SETTINGS: ROLLOVER TOGGLE ----
    document.getElementById('rollover-toggle').addEventListener('change', function() {
        settings.rollover = this.checked;
        saveSettings();
        showToast(this.checked ? 'Task rollover enabled.' : 'Task rollover disabled.', '');
    });

    // ---- SETTINGS: EXPORT ----
    document.getElementById('export-btn').addEventListener('click', exportJournal);

    // ---- SETTINGS: CLEAR DATA ----
    document.getElementById('clear-data-btn').addEventListener('click', function() {
        // Tampilkan modal konfirmasi
        document.getElementById('confirm-title').textContent = 'Clear All Data?';
        document.getElementById('confirm-text').textContent  = 'This will permanently delete ALL your tasks, journals, and settings. This cannot be undone.';
        document.getElementById('confirm-modal').classList.add('open');

        // Set callback ke fungsi clearAllData
        confirmCallback = clearAllData;
        pendingDeleteId = null; // Bukan hapus task, jadi reset ini
    });

    // ---- PROFILE BUTTON ----
    document.getElementById('profile-btn').addEventListener('click', function() {
        navigateTo('settings');
    });

    // ---- AUTO THEME saat preferensi sistem berubah ----
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
        if (settings.theme === 'auto') {
            applyTheme('auto');
        }
    });

    // ---- KEYBOARD SHORTCUT ----
    document.addEventListener('keydown', function(e) {
        // Tekan Escape untuk menutup modal yang terbuka
        if (e.key === 'Escape') {
            closeAddTaskModal();
            closeConfirmModal();
        }
    });

    console.log('DailyNote initialized! Today:', TODAY);
});
