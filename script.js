document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    
    // UI Elements
    const productElements = document.querySelectorAll('.product');
    const openBarBtn = document.getElementById('openBar');
    const closeBarBtn = document.getElementById('closeBar');
    const notification = document.getElementById('notification');
    const totalBarDisplay = document.getElementById('totalBar');
    const tableModal = document.getElementById('tableModal');
    const closeBarModal = document.getElementById('closeBarModal');
    const confirmClearModal = document.getElementById('confirmClearModal');
    const confirmClearBtn = document.getElementById('confirmClearBtn');
    const modalTableTitle = document.getElementById('modalTableTitle');
    const modalTotalDisplay = document.getElementById('modalTotal');
    const modalConsumedContainer = document.querySelector('.modal-consumed-products');
    const modalProductsContainer = document.querySelector('.modal-products');
    const closingForm = document.getElementById('closingReportForm');

    let isBarOpen = false;
    let currentTable = null;
    let tableToClear = null;
    let openingTime = "";
    
    // Records of all closed bills today for the final report
    let dailyClosingRecords = [];

    const bills = {
        table1: { total: 0, products: [] },
        table2: { total: 0, products: [] },
        table3: { total: 0, products: [] },
        table4: { total: 0, products: [] },
        table5: { total: 0, products: [] },
        table6: { total: 0, products: [] }
    };

    // --- Helpers ---

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const recalcGeneralTotal = () => {
        return Object.values(bills).reduce((sum, table) => sum + table.total, 0);
    };

    const updateGeneralTotalUI = () => {
        totalBarDisplay.textContent = formatCurrency(recalcGeneralTotal());
    };

    function showNotification(message, type = 'success') {
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        setTimeout(() => notification.classList.remove('show'), 3000);
    }

    const groupProducts = (products) => {
        return products.reduce((acc, product) => {
            if (!acc[product.name]) {
                acc[product.name] = { quantity: 0, total: 0, price: product.price };
            }
            acc[product.name].quantity++;
            acc[product.name].total += product.price;
            return acc;
        }, {});
    };

    // --- Modals Logic ---

    const openModal = (modal) => {
        modal.classList.add('active');
        modal.style.display = 'flex';
        setTimeout(() => modal.style.opacity = '1', 10);
    };

    const closeModal = (modal) => {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }, 300);
    };

    // --- UI Updates ---

    const updateUI = (tableId) => {
        const table = document.getElementById(tableId);
        const data = bills[tableId];
        const groupedProducts = groupProducts(data.products);
        
        const consumedProductsEl = table.querySelector('.consumed-products');
        if (consumedProductsEl) {
            consumedProductsEl.innerHTML = Object.entries(groupedProducts)
                .map(([name, details]) => `
                    <div class="product-item">
                        <span>${name} <small>x${details.quantity}</small></span>
                        <span>${formatCurrency(details.total)}</span>
                    </div>
                `).join('') || '<p style="color: var(--text-dim); font-size: 0.8rem; text-align: center;">Sin consumos</p>';
        }

        const billTotalEl = table.querySelector('.bill-total');
        if (billTotalEl) {
            billTotalEl.textContent = `Total: ${formatCurrency(data.total)}`;
        }

        const statusBadge = table.querySelector('.status-badge');
        if (data.products.length > 0) {
            statusBadge.textContent = 'Ocupada';
            statusBadge.className = 'status-badge occupied';
            table.classList.add('is-occupied');
        } else {
            statusBadge.textContent = 'Libre';
            statusBadge.className = 'status-badge';
            table.classList.remove('is-occupied');
        }

        updateGeneralTotalUI();
    };

    const updateModalContent = () => {
        if (!currentTable) return;
        const data = bills[currentTable];
        const grouped = groupProducts(data.products);

        modalConsumedContainer.innerHTML = Object.entries(grouped)
            .map(([name, details]) => `
                <div class="modal-product-item" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 10px;">
                    <div>
                        <div style="font-weight: 600;">${name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-dim);">${details.quantity} unidades</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-weight: 700; color: var(--primary);">${formatCurrency(details.total)}</span>
                        <button class="btn btn-danger delete-product" data-name="${name}" style="padding: 5px 10px; border-radius: 8px;">
                            <i class="fas fa-minus"></i>
                        </button>
                    </div>
                </div>
            `).join('') || '<div style="text-align: center; padding: 40px; color: var(--text-dim);"><i class="fas fa-shopping-basket" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>Mesa vacía</div>';

        modalTotalDisplay.textContent = formatCurrency(data.total).replace('$', '').trim();
        modalTableTitle.textContent = `Gestión Mesa ${currentTable.replace('table', '')}`;
    };

    const initModalMenu = () => {
        modalProductsContainer.innerHTML = Array.from(productElements)
            .map((productEl) => {
                const { name, price } = productEl.dataset;
                const iconClass = productEl.querySelector('i').className;
                return `
                    <div class="modal-menu-product" data-name="${name}" data-price="${price}" style="cursor: pointer; display: flex; align-items: center; gap: 15px; padding: 12px; border-radius: 12px; transition: all 0.2s; border: 1px solid transparent;">
                        <i class="${iconClass}" style="color: var(--primary); font-size: 1.2rem;"></i>
                        <div style="flex: 1;">
                            <div style="font-size: 0.9rem; font-weight: 600;">${name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-dim);">${formatCurrency(price)}</div>
                        </div>
                        <i class="fas fa-plus-circle" style="color: var(--primary); opacity: 0.5;"></i>
                    </div>`;
            }).join('');
            
        // Hover effects for menu items
        modalProductsContainer.querySelectorAll('.modal-menu-product').forEach(el => {
            el.onmouseover = () => { el.style.background = 'rgba(212, 175, 55, 0.1)'; el.style.borderColor = 'var(--primary)'; };
            el.onmouseout = () => { el.style.background = 'transparent'; el.style.borderColor = 'transparent'; };
        });
    };

    // --- PDF Functions ---

    const generateInvoicePDF = (tableId) => {
        const data = bills[tableId];
        if (data.products.length === 0) {
            showNotification('No hay productos en la mesa', 'error');
            return;
        }

        const doc = new jsPDF({ unit: 'mm', format: [80, 200] }); // Receipt format
        const tableNum = tableId.replace('table', '');
        const date = new Date().toLocaleString();
        
        doc.setFontSize(10);
        doc.text('EL RINCÓN DEL SABOR', 40, 10, { align: 'center' });
        doc.setFontSize(8);
        doc.text('Premium Lounge & Bar', 40, 15, { align: 'center' });
        doc.text('-------------------------------------------', 40, 20, { align: 'center' });
        doc.text(`MESA: ${tableNum}`, 10, 25);
        doc.text(`FECHA: ${date}`, 10, 30);
        doc.text('-------------------------------------------', 40, 35, { align: 'center' });
        
        let y = 40;
        const grouped = groupProducts(data.products);
        Object.entries(grouped).forEach(([name, details]) => {
            doc.text(`${name} x${details.quantity}`, 10, y);
            doc.text(`${formatCurrency(details.total)}`, 70, y, { align: 'right' });
            y += 5;
        });
        
        doc.text('-------------------------------------------', 40, y + 2, { align: 'center' });
        doc.setFontSize(10);
        doc.text('TOTAL:', 10, y + 8);
        doc.text(`${formatCurrency(data.total)}`, 70, y + 8, { align: 'right' });
        
        doc.setFontSize(8);
        doc.text('¡Gracias por su visita!', 40, y + 15, { align: 'center' });
        
        doc.save(`Ticket_Mesa_${tableNum}.pdf`);
        
        // Record this bill for the daily report
        dailyClosingRecords.push({
            table: tableNum,
            total: data.total,
            products: grouped,
            time: date
        });
        
        // Clear table after invoice
        bills[tableId].products = [];
        bills[tableId].total = 0;
        updateUI(tableId);
        if (currentTable === tableId) updateModalContent();
    };

    const generateDailyReportPDF = (formData) => {
        const doc = new jsPDF();
        const totalSales = dailyClosingRecords.reduce((sum, rec) => sum + rec.total, 0);
        
        // Header
        doc.setFillColor(15, 15, 15);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(212, 175, 55);
        doc.setFontSize(24);
        doc.text('REPORTE FINAL DE JORNADA', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text(`Fecha: ${formData.date} | Encargado: ${formData.staff}`, 105, 30, { align: 'center' });

        // General Info
        doc.setTextColor(30, 30, 30);
        doc.setFontSize(14);
        doc.text('Resumen de Operación:', 20, 55);
        doc.setFontSize(11);
        doc.text(`Hora Apertura: ${formData.openTime}`, 20, 65);
        doc.text(`Hora Cierre: ${formData.closeTime}`, 20, 72);
        doc.text(`Base Caja: ${formatCurrency(formData.baseCash)}`, 120, 65);
        doc.text(`Efectivo Final: ${formatCurrency(formData.finalCash)}`, 120, 72);

        // Sales Info
        doc.setDrawColor(212, 175, 55);
        doc.line(20, 80, 190, 80);
        doc.setFontSize(14);
        doc.text('Detalle de Ventas:', 20, 95);
        
        let y = 105;
        doc.setFontSize(10);
        dailyClosingRecords.forEach(rec => {
            doc.text(`Mesa ${rec.table} - ${rec.time}`, 20, y);
            doc.text(`${formatCurrency(rec.total)}`, 190, y, { align: 'right' });
            y += 8;
        });

        // Totals
        y += 10;
        doc.line(20, y, 190, y);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('TOTAL VENTAS:', 20, y + 15);
        doc.text(`${formatCurrency(totalSales)}`, 190, y + 15, { align: 'right' });
        
        const balance = formData.finalCash - (parseFloat(formData.baseCash) + totalSales);
        doc.setFontSize(12);
        doc.text('Diferencia en Caja:', 20, y + 25);
        doc.setTextColor(balance < 0 ? 200 : 0, balance > 0 ? 150 : 0, 0);
        doc.text(`${formatCurrency(balance)}`, 190, y + 25, { align: 'right' });

        // Notes
        if (formData.notes) {
            doc.setTextColor(30, 30, 30);
            doc.setFont(undefined, 'normal');
            doc.text('Observaciones:', 20, y + 40);
            doc.setFontSize(9);
            const splitNotes = doc.splitTextToSize(formData.notes, 170);
            doc.text(splitNotes, 20, y + 48);
        }

        doc.save(`Reporte_Diario_${formData.date}.pdf`);
        showNotification('Reporte diario generado exitosamente');
    };

    // --- Events ---

    openBarBtn.addEventListener('click', () => {
        isBarOpen = true;
        openingTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        openBarBtn.disabled = true;
        closeBarBtn.disabled = false;
        showNotification('Bar Abierto. Jornada iniciada 🍹');
        document.body.style.background = 'var(--bg-dark)';
    });

    closeBarBtn.addEventListener('click', () => {
        // Set default values for the form
        document.getElementById('reportDate').valueAsDate = new Date();
        document.getElementById('openTime').value = openingTime;
        document.getElementById('closeTime').value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        openModal(closeBarModal);
    });

    closingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = {
            date: document.getElementById('reportDate').value,
            staff: document.getElementById('reportStaff').value,
            openTime: document.getElementById('openTime').value,
            closeTime: document.getElementById('closeTime').value,
            baseCash: document.getElementById('baseCash').value,
            finalCash: document.getElementById('finalCash').value,
            notes: document.getElementById('reportNotes').value
        };
        
        generateDailyReportPDF(formData);
        closeModal(closeBarModal);
        
        // Reset App State
        isBarOpen = false;
        openBarBtn.disabled = false;
        closeBarBtn.disabled = true;
        dailyClosingRecords = [];
        showNotification('Jornada finalizada y bar cerrado 🏠', 'warning');
    });

    // Table Interaction
    document.querySelectorAll('.table').forEach(table => {
        table.addEventListener('click', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.drop-zone')) return;
            if (!isBarOpen) {
                showNotification('El bar está cerrado. Ábralo para operar.', 'warning');
                return;
            }
            currentTable = table.id;
            updateModalContent();
            openModal(tableModal);
        });
    });

    // Modal Item Add
    modalProductsContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.modal-menu-product');
        if (item && currentTable) {
            const product = {
                name: item.dataset.name,
                price: parseFloat(item.dataset.price)
            };
            bills[currentTable].products.push(product);
            bills[currentTable].total += product.price;
            updateUI(currentTable);
            updateModalContent();
            showNotification(`${product.name} añadido`);
        }
    });

    // Modal Item Remove
    modalConsumedContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-product');
        if (btn && currentTable) {
            const name = btn.dataset.name;
            const idx = bills[currentTable].products.findIndex(p => p.name === name);
            if (idx > -1) {
                const removed = bills[currentTable].products.splice(idx, 1)[0];
                bills[currentTable].total -= removed.price;
                updateUI(currentTable);
                updateModalContent();
                showNotification(`${name} removido`, 'warning');
            }
        }
    });

    // Generate Invoice
    document.querySelectorAll('.btn-generate').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            generateInvoicePDF(`table${btn.dataset.table}`);
        };
    });

    document.getElementById('modalGenerateBill').onclick = () => {
        if (currentTable) {
            generateInvoicePDF(currentTable);
            closeModal(tableModal);
        }
    };

    // Close Modals by clicking backdrop
    window.addEventListener('click', (e) => {
        if (e.target === tableModal) closeModal(tableModal);
        if (e.target === closeBarModal) closeModal(closeBarModal);
        if (e.target === confirmClearModal) closeModal(confirmClearModal);
    });

    document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
        btn.onclick = () => {
            closeModal(tableModal);
            closeModal(closeBarModal);
            closeModal(confirmClearModal);
        };
    });

    // Drag & Drop
    productElements.forEach(p => {
        p.ondragstart = (e) => {
            if (!isBarOpen) { e.preventDefault(); return; }
            e.dataTransfer.setData('product', JSON.stringify({
                name: p.dataset.name,
                price: parseFloat(p.dataset.price)
            }));
            p.style.opacity = '0.5';
        };
        p.ondragend = () => p.style.opacity = '1';
    });

    document.querySelectorAll('.table').forEach(table => {
        const zone = table.querySelector('.drop-zone');
        zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
        zone.ondragleave = () => zone.classList.remove('drag-over');
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (!isBarOpen) return;
            const product = JSON.parse(e.dataTransfer.getData('product'));
            const tid = table.id;
            bills[tid].products.push(product);
            bills[tid].total += product.price;
            updateUI(tid);
            showNotification(`${product.name} -> Mesa ${tid.replace('table','')}`);
        };
    });

    // Clear Table
    document.querySelectorAll('.btn-clear').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            tableToClear = `table${btn.dataset.table}`;
            openModal(confirmClearModal);
        };
    });

    confirmClearBtn.onclick = () => {
        if (tableToClear) {
            bills[tableToClear].products = [];
            bills[tableToClear].total = 0;
            updateUI(tableToClear);
            closeModal(confirmClearModal);
            showNotification('Mesa limpiada exitosamente');
            tableToClear = null;
        }
    };

    initModalMenu();
    updateGeneralTotalUI();
});