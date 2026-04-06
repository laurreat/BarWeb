document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    
    // UI Elements
    const productElements = document.querySelectorAll('.product');
    const openBarBtn = document.getElementById('openBar');
    const closeBarBtn = document.getElementById('closeBar');
    const generateReportBtn = document.getElementById('generateReport');
    const notification = document.getElementById('notification');
    const totalBarDisplay = document.getElementById('totalBar');
    const tableModal = document.getElementById('tableModal');
    const modalTableTitle = document.getElementById('modalTableTitle');
    const modalTotalDisplay = document.getElementById('modalTotal');
    const modalConsumedContainer = document.querySelector('.modal-consumed-products');
    const modalProductsContainer = document.querySelector('.modal-products');

    let isBarOpen = false;
    let currentTable = null;

    // State Persistence (Optional: LocalStorage)
    const bills = {
        table1: { total: 0, products: [] },
        table2: { total: 0, products: [] },
        table3: { total: 0, products: [] },
        table4: { total: 0, products: [] }
    };

    // --- Core Logic ---

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

    // --- UI Updates ---

    const updateUI = (tableId) => {
        const table = document.getElementById(tableId);
        const data = bills[tableId];
        const groupedProducts = groupProducts(data.products);
        
        // Update Products List
        const consumedProductsEl = table.querySelector('.consumed-products');
        if (consumedProductsEl) {
            consumedProductsEl.innerHTML = Object.entries(groupedProducts)
                .map(([name, details]) => `
                    <div class="product-item">
                        <span>${name} <small>x${details.quantity}</small></span>
                        <span>${formatCurrency(details.total)}</span>
                    </div>
                `).join('') || '<p class="empty-msg">Sin consumos</p>';
        }

        // Update Total
        const billTotalEl = table.querySelector('.bill-total');
        if (billTotalEl) {
            billTotalEl.textContent = `Total: ${formatCurrency(data.total)}`;
        }

        // Update Status Badge & Table State
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
                <div class="modal-product-item" data-name="${name}">
                    <div class="item-info">
                        <strong>${name}</strong>
                        <span>${details.quantity} unidades</span>
                    </div>
                    <div class="item-actions">
                        <span>${formatCurrency(details.total)}</span>
                        <button class="delete-product" data-name="${name}" title="Quitar uno">
                            <i class="fas fa-minus-circle"></i>
                        </button>
                    </div>
                </div>
            `).join('') || '<div class="empty-modal-state"><i class="fas fa-shopping-basket"></i><p>No hay consumos en esta mesa</p></div>';

        modalTotalDisplay.textContent = formatCurrency(data.total).replace('$', '').trim();
        modalTableTitle.textContent = `Gestión Mesa ${currentTable.replace('table', '')}`;
    };

    const initModalMenu = () => {
        modalProductsContainer.innerHTML = Array.from(productElements)
            .map((productEl) => {
                const { name, price } = productEl.dataset;
                const iconClass = productEl.querySelector('i').className;
                return `
                    <div class="modal-menu-product" data-name="${name}" data-price="${price}">
                        <div class="menu-item-icon"><i class="${iconClass}"></i></div>
                        <div class="menu-item-details">
                            <span class="name">${name}</span>
                            <span class="price">${formatCurrency(price)}</span>
                        </div>
                        <i class="fas fa-plus"></i>
                    </div>`;
            }).join('');
    };

    // --- PDF Generation ---

    const generateInvoice = (tableId) => {
        const data = bills[tableId];
        if (data.products.length === 0) {
            showNotification('No hay productos para facturar', 'error');
            return;
        }

        const doc = new jsPDF();
        const tableNum = tableId.replace('table', '');
        
        // Header
        doc.setFillColor(33, 33, 33);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text('EL RINCÓN DEL SABOR', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Comprobante de Consumo - Mesa ${tableNum}`, 105, 30, { align: 'center' });

        // Body
        doc.setTextColor(33, 33, 33);
        doc.setFontSize(14);
        doc.text('Detalle de Productos:', 20, 50);
        
        let y = 65;
        doc.setFontSize(12);
        const grouped = groupProducts(data.products);
        
        Object.entries(grouped).forEach(([name, details]) => {
            doc.text(`${name}`, 20, y);
            doc.text(`x${details.quantity}`, 100, y);
            doc.text(`${formatCurrency(details.total)}`, 160, y);
            y += 10;
        });

        // Footer
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y + 5, 190, y + 5);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`TOTAL A PAGAR: ${formatCurrency(data.total)}`, 190, y + 20, { align: 'right' });

        doc.save(`Factura_Mesa_${tableNum}.pdf`);
        showNotification('Factura generateda correctamente');
    };

    // --- Event Listeners ---

    // Drag & Drop
    productElements.forEach((product) => {
        product.addEventListener('dragstart', (e) => {
            if (!isBarOpen) {
                e.preventDefault();
                showNotification('El bar está cerrado 🚫', 'error');
                return;
            }
            const data = {
                name: product.dataset.name,
                price: parseFloat(product.dataset.price)
            };
            e.dataTransfer.setData('text/plain', JSON.stringify(data));
            product.classList.add('dragging');
        });

        product.addEventListener('dragend', () => {
            product.classList.remove('dragging');
        });
    });

    document.querySelectorAll('.drop-zone').forEach((zone) => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            if (!isBarOpen) return;

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                const tableId = e.target.closest('.table').id;
                
                bills[tableId].products.push(data);
                bills[tableId].total += data.price;
                
                updateUI(tableId);
                if (currentTable === tableId) updateModalContent();
                showNotification(`${data.name} añadido a Mesa ${tableId.replace('table','')} ✅`);
            } catch (err) {
                console.error('Error in drop:', err);
            }
        });
    });

    // Bar Controls
    openBarBtn.addEventListener('click', () => {
        isBarOpen = true;
        document.body.classList.add('bar-active');
        showNotification('¡Bar abierto! 🍻', 'success');
        openBarBtn.disabled = true;
        closeBarBtn.disabled = false;
    });

    closeBarBtn.addEventListener('click', () => {
        isBarOpen = false;
        document.body.classList.remove('bar-active');
        showNotification('¡Bar cerrado! 🔒', 'warning');
        openBarBtn.disabled = false;
        closeBarBtn.disabled = true;
    });

    // Table Actions
    document.querySelectorAll('.btn-clear').forEach((button) => {
        button.addEventListener('click', (e) => {
            const tableNum = e.currentTarget.dataset.table;
            const tableId = `table${tableNum}`;
            
            if (confirm(`¿Estás seguro de limpiar la Mesa ${tableNum}?`)) {
                bills[tableId].total = 0;
                bills[tableId].products = [];
                updateUI(tableId);
                if (currentTable === tableId) updateModalContent();
                showNotification(`Mesa ${tableNum} despejada 🧹`);
            }
        });
    });

    document.querySelectorAll('.btn-generate').forEach((button) => {
        button.addEventListener('click', (e) => {
            const tableId = `table${e.currentTarget.dataset.table}`;
            generateInvoice(tableId);
        });
    });

    // Modal Events
    document.querySelectorAll('.table').forEach((table) => {
        table.addEventListener('click', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.drop-zone')) return;
            if (!isBarOpen) {
                showNotification('Abre el bar para gestionar mesas', 'warning');
                return;
            }
            currentTable = table.id;
            tableModal.classList.add('active');
            updateModalContent();
        });
    });

    modalProductsContainer.addEventListener('click', (e) => {
        const productEl = e.target.closest('.modal-menu-product');
        if (productEl && currentTable) {
            const data = {
                name: productEl.dataset.name,
                price: parseFloat(productEl.dataset.price)
            };
            bills[currentTable].products.push(data);
            bills[currentTable].total += data.price;
            updateUI(currentTable);
            updateModalContent();
            showNotification(`${data.name} añadido ✅`);
        }
    });

    modalConsumedContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-product');
        if (btn && currentTable) {
            const name = btn.dataset.name;
            const index = bills[currentTable].products.findIndex(p => p.name === name);
            if (index > -1) {
                const removed = bills[currentTable].products.splice(index, 1)[0];
                bills[currentTable].total -= removed.price;
                updateUI(currentTable);
                updateModalContent();
                showNotification(`${name} eliminado`, 'warning');
            }
        }
    });

    const closeModal = () => {
        tableModal.classList.remove('active');
        currentTable = null;
    };

    document.querySelector('.close-modal').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === tableModal) closeModal(); });

    document.getElementById('modalGenerateBill').addEventListener('click', () => {
        if (currentTable) generateInvoice(currentTable);
    });

    // General Report
    generateReportBtn.addEventListener('click', () => {
        const total = recalcGeneralTotal();
        if (total === 0) {
            showNotification('No hay ventas registradas para el reporte', 'error');
            return;
        }

        const doc = new jsPDF();
        doc.setFillColor(33, 33, 33);
        doc.rect(0, 0, 210, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('REPORTE DIARIO DE CAJA', 105, 20, { align: 'center' });

        doc.setTextColor(33, 33, 33);
        let y = 50;
        
        Object.keys(bills).forEach(tableId => {
            const data = bills[tableId];
            if (data.products.length > 0) {
                doc.setFont(undefined, 'bold');
                doc.text(`Mesa ${tableId.replace('table','')}:`, 20, y);
                doc.setFont(undefined, 'normal');
                y += 10;
                
                const grouped = groupProducts(data.products);
                Object.entries(grouped).forEach(([name, details]) => {
                    doc.text(`- ${name} x${details.quantity}`, 30, y);
                    doc.text(`${formatCurrency(details.total)}`, 160, y);
                    y += 8;
                });
                y += 5;
            }
        });

        doc.setDrawColor(0);
        doc.line(20, y, 190, y);
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`VENTA TOTAL: ${formatCurrency(total)}`, 190, y + 15, { align: 'right' });

        doc.save('Reporte_Caja_Premium.pdf');
    });

    // Initialize
    initModalMenu();
    updateGeneralTotalUI();
    closeBarBtn.disabled = true; // Initial state
});
  