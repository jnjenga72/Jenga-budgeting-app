document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const transactionForm = document.getElementById('transaction-form');
    const dateInput = document.getElementById('date');
    const amountInput = document.getElementById('amount');
    const typeSelect = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    const transactionList = document.getElementById('transaction-list');
    const filterCategorySelect = document.getElementById('filter-category');
    const searchInput = document.getElementById('search-transactions');
    const totalIncomeSpan = document.getElementById('total-income');
    const totalExpensesSpan = document.getElementById('total-expenses');
    const remainingBalanceSpan = document.getElementById('remaining-balance');
    const notificationArea = document.getElementById('notification-area');
    const smsTextarea = document.getElementById('sms-text');
    const importBtn = document.getElementById('import-btn');
    const navBtns = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');
    const themeToggle = document.getElementById('theme-toggle');
    const budgetForm = document.getElementById('budget-form');
    const budgetCategorySelect = document.getElementById('budget-category');
    const budgetAmountInput = document.getElementById('budget-amount');
    const budgetProgressList = document.getElementById('budget-progress-list');
    const cashRegisterSound = document.getElementById('cash-register-sound');
    const exportDataBtn = document.getElementById('export-data-btn');
    const restoreFileInput = document.getElementById('restore-file-input');

    // --- Global State ---
    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    let budgets = JSON.parse(localStorage.getItem('budgets')) || {};
    let spendingChart;
    let editID = null;

    // --- Functions ---

    /**
     * Plays the cash register sound effect.
     */
    function playCashRegisterSound() {
        if (cashRegisterSound) {
            cashRegisterSound.currentTime = 0; // Reset to start
            cashRegisterSound.play().catch(error => {
                console.log('Audio playback blocked by browser. This is normal until the user interacts with the page.', error);
            });
        }
    }

    /**
     * Theme toggle logic
     */
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        // Re-render chart to ensure it looks right in dark mode
        if (document.getElementById('dashboard').classList.contains('active')) updateChart();
    });

    /**
     * Navigation logic to switch between pages.
     */
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.getAttribute('data-page');
            
            // Update buttons
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update pages
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(targetPage).classList.add('active');
            
            if (targetPage === 'dashboard') updateChart();
        });
    });

    /**
     * Generates a unique ID for a new transaction.
     * @returns {string} A unique ID.
     */
    function generateID() {
        return Math.random().toString(36).substr(2, 9);
    }

    /**
     * Parses pasted SMS text (M-Pesa/Bank) and fills the form.
     */
    function handleSMSImport() {
        const text = smsTextarea.value.trim();
        if (!text) return;

        // RegEx for Amount (Ksh 1,234.56 or Ksh1234.56)
        const amountMatch = text.match(/Ksh\s?([\d,]+\.?\d*)/i);
        
        // RegEx for Date (DD/MM/YY or YYYY-MM-DD)
        const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/) || text.match(/(\d{4}-\d{2}-\d{2})/);

        if (amountMatch) {
            // Clean commas from amount
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
            amountInput.value = amount;

            // Determine type based on keywords
            const expenseKeywords = ['paid', 'sent', 'withdraw', 'sent to', 'debit', 'bill'];
            const incomeKeywords = ['received', 'deposited', 'credit', 'ref:'];
            
            const lowerText = text.toLowerCase();
            const isExpense = expenseKeywords.some(kw => lowerText.includes(kw));
            const isIncome = incomeKeywords.some(kw => lowerText.includes(kw));

            if (isExpense) {
                typeSelect.value = 'expense';
                categorySelect.value = text.toLowerCase().includes('kplc') || text.toLowerCase().includes('rent') ? 'Rent' : 'Other';
            } else if (isIncome) {
                typeSelect.value = 'income';
                categorySelect.value = 'Salary';
            }

            // Try to set date if found, otherwise use today
            if (dateMatch) {
                // Convert DD/MM/YY to YYYY-MM-DD if necessary for the input[type=date]
                const parts = dateMatch[0].split('/');
                if (parts.length === 3) {
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    dateInput.value = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                } else {
                dateInput.value = dateMatch[1];
                }
            } else {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            
            smsTextarea.value = '';
            alert('SMS parsed successfully! Check the form below.');
        } else {
            alert('Could not find a valid Ksh amount in the text.');
        }
    }

    /**
     * Adds a new transaction to the list.
     * @param {Event} e - The form submission event.
     */
    function addTransaction(e) {
        e.preventDefault(); // Prevent default form submission

        const date = dateInput.value;
        const amount = parseFloat(amountInput.value);
        const type = typeSelect.value;
        const category = categorySelect.value;

        if (date === '' || isNaN(amount) || amount <= 0) {
            alert('Please enter a valid date and a positive amount.');
            return;
        }

        if (editID) {
            // Update existing transaction
            transactions = transactions.map(t => t.id === editID ? { ...t, date, amount, type, category } : t);
            editID = null;
            transactionForm.querySelector('button[type="submit"]').textContent = 'Add Transaction';
        } else {
            // Add new transaction
            const newTransaction = {
                id: generateID(),
                date,
                amount,
                type,
                category
            };
            transactions.push(newTransaction);
        }

        updateLocalStorage();
        initApp();
        updateSummary();

        // Clear form fields
        dateInput.value = new Date().toISOString().split('T')[0];
        amountInput.value = '';
        typeSelect.value = 'income'; // Reset to default
        categorySelect.value = categorySelect.options[0].value;
    }

    function renderTransactions() {
        transactionList.innerHTML = '';
        const filterValue = filterCategorySelect.value;
        const searchValue = searchInput.value.toLowerCase();

        let filteredTransactions = filterValue === 'all' 
            ? transactions 
            : transactions.filter(t => t.category === filterValue);

        if (searchValue) {
            filteredTransactions = filteredTransactions.filter(t => 
                t.date.includes(searchValue) || 
                t.amount.toString().includes(searchValue)
            );
        }

        // Sort by date: most recent first
        const sortedTransactions = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));

        if (sortedTransactions.length === 0) {
            transactionList.innerHTML = '<li style="text-align: center; color: #888; padding: 20px;">No transactions yet. Add some!</li>';
            return;
        }

        sortedTransactions.forEach(transaction => {
            const listItem = document.createElement('li');
            listItem.classList.add(transaction.type); // Add 'income' or 'expense' class for styling
            listItem.setAttribute('data-id', transaction.id);

            const sign = transaction.type === 'income' ? '+' : '-';
            const amountClass = transaction.type === 'income' ? 'income-amount' : 'expense-amount';

            listItem.innerHTML = `
                <div class="transaction-details">
                    <span class="date">${transaction.date}</span>
                    <span class="amount ${amountClass}">${sign}Ksh ${transaction.amount.toFixed(2)}</span>
                    <span class="category-badge">${transaction.category}</span>
                </div>
                <div class="actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">x</button>
                </div>
            `;

            listItem.querySelector('.edit-btn').addEventListener('click', () => prepareEdit(transaction));
            listItem.querySelector('.delete-btn').addEventListener('click', () => deleteTransaction(transaction.id));

            transactionList.appendChild(listItem);
        });
    }

    /**
     * Fills the form with transaction data to allow editing.
     * @param {Object} transaction - The transaction object to edit.
     */
    function prepareEdit(transaction) {
        dateInput.value = transaction.date;
        amountInput.value = transaction.amount;
        typeSelect.value = transaction.type;
        categorySelect.value = transaction.category;
        
        editID = transaction.id;
        transactionForm.querySelector('button[type="submit"]').textContent = 'Update Transaction';
        window.scrollTo({ top: transactionForm.offsetTop, behavior: 'smooth' });
    }

    /**
     * Deletes a transaction from the list.
     * @param {string} id - The ID of the transaction to delete.
     */
    function deleteTransaction(id) {
        if (editID === id) editID = null; // Clear edit state if deleting the active item
        transactionForm.querySelector('button[type="submit"]').textContent = 'Add Transaction';
        transactions = transactions.filter(transaction => transaction.id !== id);
        updateLocalStorage();
        initApp();
        updateSummary();
    }

    /**
     * Updates the budget summary (total income, total expenses, remaining balance).
     */
    function updateSummary() {
        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((acc, t) => acc + t.amount, 0);

        const totalExpenses = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => acc + t.amount, 0);

        const remainingBalance = totalIncome - totalExpenses;

        totalIncomeSpan.textContent = totalIncome.toFixed(2);
        totalExpensesSpan.textContent = totalExpenses.toFixed(2);
        remainingBalanceSpan.textContent = remainingBalance.toFixed(2);

        // Optional: Change balance color based on positive/negative
        remainingBalanceSpan.style.color = remainingBalance >= 0 ? '#AE2012' : '#dc3545';
    }

    /**
     * Checks if rent is due soon (19th of the month) and displays a notification.
     */
    function checkRentReminder() {
        const today = new Date();
        const currentDay = today.getDate();
        const rentDay = 19;
        const leadDays = 4; // Start alerting 4 days before (from the 15th)

        notificationArea.innerHTML = ''; // Clear previous alerts

        if (currentDay === rentDay) {
            notificationArea.innerHTML = `
                <div class="alert alert-danger">
                    ⚠️ Rent Day! Don't forget to pay your rent today (19th).
                </div>`;
        } else if (currentDay >= (rentDay - leadDays) && currentDay < rentDay) {
            const daysLeft = rentDay - currentDay;
            notificationArea.innerHTML = `
                <div class="alert alert-warning">
                    📅 Rent Reminder: Your rent is due in ${daysLeft} day${daysLeft > 1 ? 's' : ''} (on the 19th).
                </div>`;
        }
    }

    /**
     * Aggregates spending data and updates the Chart.js doughnut chart.
     */
    function updateChart() {
        const ctx = document.getElementById('spending-chart').getContext('2d');
        
        const expenseData = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {});

        const labels = Object.keys(expenseData);
        const data = Object.values(expenseData);

        if (spendingChart) {
            spendingChart.destroy();
        }

        spendingChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#AE2012', '#D4AF37', '#9A031E', '#E36414', '#0F4C5C', '#5F0F40', '#FB8B24'
                    ]
                }]
            },
            options: {
                maintainAspectRatio: false, // Crucial for responsiveness
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' },
                    title: { display: true, text: 'Spending habits by Category' }
                }
            }
        });
    }

    /**
     * Plays a custom Jenga-style brick stacking animation.
     */
    function playJengaAnimation() {
        const container = document.createElement('div');
        container.className = 'jenga-stack-animation';
        document.body.appendChild(container);

        // Drop 5 bricks to "build" the budget
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const brick = document.createElement('div');
                brick.className = 'animation-brick';
                // Alternate between Brick Red and Golden
                brick.style.backgroundColor = i % 2 === 0 ? '#AE2012' : '#D4AF37';
                container.appendChild(brick);
            }, i * 200);
        }

        // Fade out and remove after animation
        setTimeout(() => {
            container.classList.add('fade-out');
            setTimeout(() => container.remove(), 1000);
        }, 2500);
    }

    /**
     * Saves a budget limit for a specific category.
     */
    function saveBudget(e) {
        e.preventDefault();
        const category = budgetCategorySelect.value;
        const amount = parseFloat(budgetAmountInput.value);
        
        if (isNaN(amount) || amount < 0) return;
        
        budgets[category] = amount;
        localStorage.setItem('budgets', JSON.stringify(budgets));
        budgetAmountInput.value = '';
        playJengaAnimation();
        initApp();
    }

    /**
     * Renders progress bars for set budgets on the dashboard.
     */
    function renderBudgetProgress() {
        budgetProgressList.innerHTML = '';
        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

        Object.keys(budgets).forEach(category => {
            const limit = budgets[category];
            const spent = transactions
                .filter(t => t.type === 'expense' && t.category === category && t.date.startsWith(currentMonth))
                .reduce((acc, t) => acc + t.amount, 0);

            const percent = Math.min((spent / limit) * 100, 100);
            let statusClass = '';
            if (percent >= 90) statusClass = 'danger';
            else if (percent >= 70) statusClass = 'warning';

            const item = document.createElement('div');
            item.className = 'budget-progress-item';
            item.innerHTML = `
                <div class="budget-info">
                    <span>${category}</span>
                    <span>Ksh ${spent.toFixed(0)} / Ksh ${limit.toFixed(0)}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar ${statusClass}" style="width: ${percent}%"></div>
                </div>
            `;
            budgetProgressList.appendChild(item);
        });

        if (Object.keys(budgets).length === 0) {
            budgetProgressList.innerHTML = '<p style="text-align:center; color:#888;">No budgets set. Go to the Budgets tab to start.</p>';
        }
    }

    /**
     * Helper to re-render the list and the chart.
     */
    function initApp() {
        renderTransactions();
        updateChart();
        checkRentReminder();
        renderBudgetProgress();

        // Play cash register sound when logo bars finish rising (1.3s total)
        setTimeout(playCashRegisterSound, 1300);

        // Hide loader after a small delay for smooth transition
        setTimeout(() => {
            const loader = document.getElementById('app-loader');
            if (loader) {
                loader.classList.add('loader-hidden');
                document.body.classList.remove('is-loading');
            }
        }, 2000);
    }

    /**
     * Exports all budget data to a JSON file.
     */
    function exportData() {
        const data = {
            transactions,
            budgets,
            theme: localStorage.getItem('theme') || 'light'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jenga_budget_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Restores budget data from a selected JSON file.
     */
    function restoreData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                if (data.transactions && data.budgets) {
                    if (confirm('This will overwrite your current data. Are you sure?')) {
                        localStorage.setItem('transactions', JSON.stringify(data.transactions));
                        localStorage.setItem('budgets', JSON.stringify(data.budgets));
                        if (data.theme) localStorage.setItem('theme', data.theme);
                        
                        alert('Data restored successfully! The app will now reload.');
                        location.reload();
                    }
                } else {
                    alert('Invalid backup file format.');
                }
            } catch (err) {
                alert('Error reading file: ' + err.message);
            }
        };
        reader.readAsText(file);
    }

    /**
     * Register Service Worker for Offline/PWA support
     */
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registered successfully.'))
                .catch(err => console.log('Service Worker registration failed:', err));
        });
    }

    /**
     * Saves the current transactions array to local storage.
     */
    function updateLocalStorage() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    // --- Event Listeners ---
    transactionForm.addEventListener('submit', addTransaction);
    budgetForm.addEventListener('submit', saveBudget);
    filterCategorySelect.addEventListener('change', renderTransactions);
    searchInput.addEventListener('input', renderTransactions);
    importBtn.addEventListener('click', handleSMSImport);
    exportDataBtn.addEventListener('click', exportData);
    restoreFileInput.addEventListener('change', restoreData);

    // --- Initial Render ---
    initApp();
    updateSummary();
});