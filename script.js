document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    
    // --- UI Elements ---
    const sidebarProductsContainer = document.querySelector('.bar .products');
    const mainTablesContainer = document.querySelector('.tables');
    const totalBarDisplay = document.getElementById('totalBar');
    const notification = document.getElementById('notification');
    
    // Modals
    const tableModal = document.getElementById('tableModal');
    const closeBarModal = document.getElementById('closeBarModal');
    const managerModal = document.getElementById('managerModal');
    const confirmClearModal = document.getElementById('confirmClearModal');
    
    // Form/Inputs
    const closingForm = document.getElementById('closingReportForm');
    const newProductForm = document.getElementById('newProductForm');
    const addTableBtn = document.getElementById('addTableBtn');
    const resetTablesBtn = document.getElementById('resetTablesBtn');
    const tableCountDisplay = document.getElementById('tableCountDisplay');

    // State Variables
    let isBarOpen = false;
    let currentTable = null;
    let tableToClear = null;
    let openingTime = "";
    let dailyClosingRecords = [];

    // --- Persisted Data ---
    
    const defaultProducts = [
        { name: "Cerveza", price: 8500, icon: "fas fa-beer" },
        { name: "Vino", price: 25000, icon: "fas fa-wine-glass" },
        { name: "Cóctel", price: 35000, icon: "fas fa-cocktail" },
        { name: "Refresco", price: 4000, icon: "fas fa-glass-whiskey" },
        { name: "Hamburguesa", price: 18000, icon: "fas fa-hamburger" },
        { name: "Papas Fritas", price: 8000, icon: "fas fa-fries" }
    ];

    let products = JSON.parse(localStorage.getItem('bar_products')) || defaultProducts;
    let bills = JSON.parse(localStorage.getItem('bar_bills')) || {
        table1: { total: 0, products: [] },
        table2: { total: 0, products: [] },
        table3: { total: 0, products: [] },
        table4: { total: 0, products: [] }
    };

    const saveData = () => {
        localStorage.setItem('bar_products', JSON.stringify(products));
        localStorage.setItem('bar_bills', JSON.stringify(bills));
    };

    // --- Helpers ---

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };

    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    const groupProducts = (productList) => {
        return productList.reduce((acc, p) => {
            if (!acc[p.name]) acc[p.name] = { quantity: 0, total: 0, price: p.price };
            acc[p.name].quantity++;
            acc[p.name].total += p.price;
            return acc;
        }, {});
    };

    // --- Renderers ---

    const renderProducts = () => {
        sidebarProductsContainer.innerHTML = products.map(p => `
            <div class="product" draggable="true" data-name="${p.name}" data-price="${p.price}">
                <i class="${p.icon}"></i>
                <div class="product-info">
                    <span class="name">${p.name}</span>
                    <span class="price">${formatCurrency(p.price)}</span>
                </div>
            </div>
        `).join('');

        // Re-attach drag events
        document.querySelectorAll('.product').forEach(el => {
            el.ondragstart = (e) => {
                if (!isBarOpen) { e.preventDefault(); return; }
                const data = { name: el.dataset.name, price: parseFloat(el.dataset.price) };
                e.dataTransfer.setData('product', JSON.stringify(data));
                el.style.opacity = '0.5';
            };
            el.ondragend = () => el.style.opacity = '1';
        });
    };

    const renderTables = () => {
        mainTablesContainer.innerHTML = Object.keys(bills).map(tid => {
            const tableNum = tid.replace('table', '');
            const data = bills[tid];
            const isOccupied = data.products.length > 0;
            return `
                <div class="table ${isOccupied ? 'is-occupied' : ''}" id="${tid}" data-table="${tableNum}">
                    <div class="table-header">
                        <h2>Mesa ${tableNum}</h2>
                        <span class="status-badge ${isOccupied ? 'occupied' : ''}">${isOccupied ? 'Ocupada' : 'Libre'}</span>
                    </div>
                    <div class="drop-zone">Arraste aquí</div>
                    <div class="consumed-products">
                        ${Object.entries(groupProducts(data.products)).map(([name, d]) => `
                            <div class="product-item">
                                <span>${name} <small>x${d.quantity}</small></span>
                                <span>${formatCurrency(d.total)}</span>
                            </div>
                        `).join('') || '<p style="color: var(--text-dim); font-size: 0.8rem; text-align: center;">Sin consumos</p>'}
                    </div>
                    <div class="bill">
                        <span class="bill-total">Total: ${formatCurrency(data.total)}</span>
                        <div class="table-actions">
                            <button class="btn btn-primary btn-generate" data-table="${tableNum}">
                                <i class="fas fa-file-invoice-dollar"></i> Factura
                            </button>
                            <button class="btn btn-danger btn-clear" data-table="${tableNum}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        tableCountDisplay.textContent = Object.keys(bills).length;

        // Re-attach events for tables
        attachTableEvents();
        updateGeneralTotalUI();
    };

    const attachTableEvents = () => {
        document.querySelectorAll('.table').forEach(table => {
            // Click to Open Modal
            table.onclick = (e) => {
                if (e.target.closest('.btn') || e.target.closest('.drop-zone')) return;
                if (!isBarOpen) { showNotification('Inicie jornada para operar.', 'warning'); return; }
                currentTable = table.id;
                updateModalContent();
                openModal(tableModal);
            };

            // Drag & Drop
            const zone = table.querySelector('.drop-zone');
            zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
            zone.ondragleave = () => zone.classList.remove('drag-over');
            zone.ondrop = (e) => {
                e.preventDefault();
                zone.classList.remove('drag-over');
                if (!isBarOpen) return;
                const product = JSON.parse(e.dataTransfer.getData('product'));
                bills[table.id].products.push(product);
                bills[table.id].total += product.price;
                saveData();
                renderTables();
                showNotification(`Añadido a Mesa ${table.id.replace('table','')}`);
            };
        });

        // Factura & Clear buttons
        document.querySelectorAll('.btn-generate').forEach(b => b.onclick = (e) => { e.stopPropagation(); generateInvoicePDF(`table${b.dataset.table}`); });
        document.querySelectorAll('.btn-clear').forEach(b => b.onclick = (e) => { e.stopPropagation(); tableToClear = `table${b.dataset.table}`; openModal(confirmClearModal); });
    };

    const updateGeneralTotalUI = () => {
        const total = Object.values(bills).reduce((s, t) => s + t.total, 0);
        totalBarDisplay.textContent = formatCurrency(total);
    };

    const updateModalContent = () => {
        if (!currentTable) return;
        const data = bills[currentTable];
        const grouped = groupProducts(data.products);
        const modalConsumed = document.querySelector('.modal-consumed-products');
        const modalProducts = document.querySelector('.modal-products');

        modalConsumed.innerHTML = Object.entries(grouped).map(([name, d]) => `
            <div class="modal-product-item" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px;">
                <div><strong>${name}</strong><br><small>${d.quantity} unidades</small></div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="color:var(--primary); font-weight:700;">${formatCurrency(d.total)}</span>
                    <button class="btn btn-danger delete-product" data-name="${name}" style="padding:4px 8px;"><i class="fas fa-minus"></i></button>
                </div>
            </div>
        `).join('') || '<div style="text-align:center; padding:30px; opacity:0.5;">Mesa sin consumos</div>';

        document.getElementById('modalTotal').textContent = formatCurrency(data.total).replace('$','').trim();
        document.getElementById('modalTableTitle').textContent = `Mesa ${currentTable.replace('table','')}`;

        // Render Menu in Modal
        modalProducts.innerHTML = products.map(p => `
            <div class="modal-menu-product" onclick="addProductToCurrentTable('${p.name}', ${p.price})" style="cursor:pointer; display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; background:rgba(255,255,255,0.02); margin-bottom:5px;">
                <i class="${p.icon}" style="color:var(--primary);"></i>
                <div style="flex:1;">
                    <div style="font-size:0.85rem; font-weight:600;">${p.name}</div>
                    <div style="font-size:0.75rem; opacity:0.6;">${formatCurrency(p.price)}</div>
                </div>
                <i class="fas fa-plus-circle" style="opacity:0.3;"></i>
            </div>
        `).join('');
    };

    window.addProductToCurrentTable = (name, price) => {
        if (!currentTable) return;
        bills[currentTable].products.push({ name, price });
        bills[currentTable].total += price;
        saveData();
        renderTables();
        updateModalContent();
    };

    // Modal Interaction
    const openModal = (m) => { m.classList.add('active'); m.style.display = 'flex'; setTimeout(() => m.style.opacity = '1', 10); };
    const closeModal = (m) => { m.style.opacity = '0'; setTimeout(() => { m.classList.remove('active'); m.style.display = 'none'; }, 300); };

    // --- Events & Forms ---

    document.getElementById('openBar').onclick = () => {
        isBarOpen = true;
        openingTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('openBar').disabled = true;
        document.getElementById('closeBar').disabled = false;
        showNotification('Bar Abierto. ¡Buena jornada! 🍹');
    };

    document.getElementById('manageBar').onclick = () => openModal(managerModal);

    document.getElementById('closeBar').onclick = () => {
        document.getElementById('reportDate').valueAsDate = new Date();
        document.getElementById('closeTime').value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        openModal(closeBarModal);
    };

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        };
    });

    // Add New Product
    newProductForm.onsubmit = (e) => {
        e.preventDefault();
        const newP = {
            name: document.getElementById('newProductName').value,
            price: parseFloat(document.getElementById('newProductPrice').value),
            icon: document.getElementById('newProductIcon').value
        };
        products.push(newP);
        saveData();
        renderProducts();
        newProductForm.reset();
        showNotification(`${newP.name} añadido al menú`);
    };

    // Add New Table
    addTableBtn.onclick = () => {
        const nextId = Object.keys(bills).length + 1;
        bills[`table${nextId}`] = { total: 0, products: [] };
        saveData();
        renderTables();
        showNotification(`Mesa ${nextId} habilitada`);
    };

    resetTablesBtn.onclick = () => {
        if (confirm('¿Resetear mesas a la configuración inicial (Mesa 1-4)?')) {
            bills = {
                table1: { total: 0, products: [] },
                table2: { total: 0, products: [] },
                table3: { total: 0, products: [] },
                table4: { total: 0, products: [] }
            };
            saveData();
            renderTables();
            showNotification('Configuración reiniciada');
        }
    };

    // --- PDF Logic (Minimal wrapper for brevity) ---
    const generateInvoicePDF = (tid) => {
        const data = bills[tid];
        if (data.products.length === 0) return showNotification('Mesa vacía', 'error');
        
        const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
        doc.setFontSize(10); doc.text('TICKET DE VENTA', 40, 10, {align:'center'});
        doc.setFontSize(8); doc.text(`Mesa: ${tid.replace('table','')}`, 10, 20);
        let y = 30;
        Object.entries(groupProducts(data.products)).forEach(([n, d]) => {
            doc.text(`${n} x${d.quantity}`, 10, y);
            doc.text(formatCurrency(d.total), 70, y, {align:'right'});
            y += 5;
        });
        doc.text('--------------------------', 40, y, {align:'center'});
        doc.text(`TOTAL: ${formatCurrency(data.total)}`, 10, y+8);
        doc.save(`Ticket_${tid}.pdf`);

        // Record for daily report
        dailyClosingRecords.push({ table: tid.replace('table',''), total: data.total, time: new Date().toLocaleTimeString() });
        
        bills[tid] = { total: 0, products: [] };
        saveData();
        renderTables();
    };

    // Generic Modal Close
    window.onclick = (e) => { 
        [tableModal, closeBarModal, managerModal, confirmClearModal].forEach(m => { if(e.target === m) closeModal(m); });
    };
    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(b => b.onclick = () => {
        [tableModal, closeBarModal, managerModal, confirmClearModal].forEach(m => closeModal(m));
    });

    document.getElementById('confirmClearBtn').onclick = () => {
        if (tableToClear) {
            bills[tableToClear] = { total: 0, products: [] };
            saveData();
            renderTables();
            closeModal(confirmClearModal);
        }
    };

    // Final Daily Report submission
    closingForm.onsubmit = (e) => {
        e.preventDefault();
        const doc = new jsPDF();
        doc.text('REPORTE DIARIO', 105, 20, {align:'center'});
        doc.text(`Ventas Totales: ${formatCurrency(dailyClosingRecords.reduce((a,b)=>a+b.total,0))}`, 20, 40);
        doc.save('Reporte_Final.pdf');
        
        // Reset everything
        isBarOpen = false;
        dailyClosingRecords = [];
        document.getElementById('openBar').disabled = false;
        document.getElementById('closeBar').disabled = true;
        closeModal(closeBarModal);
        showNotification('Cierre realizado exitosamente');
    };

    const deleteProductFromModal = (e) => {
        const btn = e.target.closest('.delete-product');
        if (btn && currentTable) {
            const name = btn.dataset.name;
            const idx = bills[currentTable].products.findIndex(p => p.name === name);
            if (idx > -1) {
                const removed = bills[currentTable].products.splice(idx, 1)[0];
                bills[currentTable].total -= removed.price;
                saveData();
                renderTables();
                updateModalContent();
            }
        }
    };
    document.querySelector('.modal-consumed-products').onclick = deleteProductFromModal;

    // --- Initial Load ---
    renderProducts();
    renderTables();
});