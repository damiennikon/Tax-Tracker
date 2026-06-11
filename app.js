// --- 1. GLOBAL ERROR CATCHER ---
window.onerror = function(message, source, lineno, colno, error) {
    alert(`CRASH ON LINE ${lineno}:\n${message}`);
    return true; 
};
window.addEventListener("unhandledrejection", function(event) {
    alert(`BACKGROUND CRASH:\n${event.reason.message || event.reason}`);
});

// --- 2. INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://YOUR_URL_HERE.supabase.co';
const SUPABASE_KEY = 'YOUR_KEY_HERE';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- 3. UI LOGIC: TOLLS ---
const tollCheckbox = document.getElementById('has-toll');
const tollContainer = document.getElementById('toll-amount-container');
const tollAmountInput = document.getElementById('toll-amount');

tollCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        tollContainer.style.display = 'block';
        tollAmountInput.required = true;
    } else {
        tollContainer.style.display = 'none';
        tollAmountInput.required = false;
        tollAmountInput.value = '';
    }
});

// --- 4. DATABASE LOGIC: SAVE TRIP ---
document.getElementById('trip-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    // NEW: Grabbing the user-selected date
    const tripDate = document.getElementById('trip-date').value;
    const startOdo = parseInt(document.getElementById('start-odo').value);
    const endOdo = parseInt(document.getElementById('end-odo').value);
    const hasToll = tollCheckbox.checked;
    const tollAmount = hasToll ? parseFloat(tollAmountInput.value) : null;

    if (endOdo <= startOdo) {
        alert("End odometer must be greater than start.");
        return;
    }

    const submitBtn = e.target.querySelector('button');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Saving...';

    const { error } = await db
        .from('trips')
        .insert([{
            date: tripDate, // Swapped from auto-generating time to the manual date
            start_odometer: startOdo,
            end_odometer: endOdo,
            total_km: endOdo - startOdo,
            has_toll: hasToll,
            toll_amount: tollAmount
        }]);

    if (error) {
        alert("Error saving trip: " + error.message);
    } else {
        e.target.reset(); 
        tollContainer.style.display = 'none';
        alert('Trip saved successfully!');
    }

    submitBtn.innerText = originalText;
});

// --- 5. DATABASE LOGIC: UPLOAD RECEIPT ---
document.getElementById('receipt-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const purchaseDate = document.getElementById('purchase-date').value;
    const merchant = document.getElementById('merchant').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file first.");
        return;
    }

    const submitBtn = e.target.querySelector('button');
    submitBtn.innerText = 'Uploading...';

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${category.replace(/\s+/g, '')}/${fileName}`;

    const { error: uploadError } = await db.storage
        .from('receipts')
        .upload(filePath, file);

    if (uploadError) {
        alert("Upload failed: " + uploadError.message);
        submitBtn.innerText = 'Upload & Save';
        return;
    }

    const { data: { publicUrl } } = db.storage
        .from('receipts')
        .getPublicUrl(filePath);

    const { error: dbError } = await db
        .from('receipts')
        .insert([{
            date: purchaseDate,
            merchant: merchant,
            amount: amount,
            category: category,
            file_url: publicUrl,
            file_type: file.type
        }]);

    if (dbError) {
        alert("Error saving record: " + dbError.message);
    } else {
        e.target.reset();
        document.getElementById('file-name-display').innerText = "No file chosen";
        alert("Receipt uploaded and saved successfully!");
    }

    submitBtn.innerText = 'Upload & Save';
});

// --- 6. VIEW RECEIPTS MODAL LOGIC ---
const viewBtn = document.getElementById('btn-view-receipts');
const modal = document.getElementById('receipt-modal');
const closeBtn = document.getElementById('close-modal');
const dateList = document.getElementById('receipt-date-list');

viewBtn.addEventListener('click', async () => {
    modal.style.display = 'block';
    dateList.innerHTML = '<p style="text-align:center; color:#666;">Loading receipts...</p>';

    try {
        const { data, error } = await db
            .from('receipts')
            .select('id, date, merchant, file_url, amount') 
            .order('date', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            dateList.innerHTML = '<p style="text-align:center; color:#666;">No receipts found.</p>';
            return;
        }

        dateList.innerHTML = '';
        
        data.forEach(receipt => {
            const dateObj = new Date(receipt.date);
            const dateStr = dateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const card = document.createElement('div');
            card.style.backgroundColor = "#fff";
            card.style.border = "1px solid #ddd";
            card.style.borderRadius = "8px";
            card.style.padding = "15px";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";

            const infoRow = document.createElement('div');
            infoRow.style.display = "flex";
            infoRow.style.justifyContent = "space-between";
            infoRow.innerHTML = `
                <span style="font-size: 1.1rem; color: #333;">📅 <strong>${dateStr}</strong></span> 
                <span style="font-size: 0.95rem; color: #666; text-align: right;">${receipt.merchant}<br><strong style="color: #28a745;">$${receipt.amount}</strong></span>
            `;

            const actionRow = document.createElement('div');
            actionRow.style.display = "flex";
            actionRow.style.justifyContent = "space-between";
            actionRow.style.marginTop = "12px";
            actionRow.style.paddingTop = "12px";
            actionRow.style.borderTop = "1px solid #eee";

            const viewLink = document.createElement('a');
            viewLink.href = receipt.file_url;
            viewLink.target = "_blank";
            viewLink.innerHTML = "📄 View Receipt";
            viewLink.style.color = "#007bff";
            viewLink.style.textDecoration = "none";
            viewLink.style.fontWeight = "bold";

            const delBtn = document.createElement('button');
            delBtn.innerHTML = "🗑️ Delete"; 
            delBtn.style.backgroundColor = "transparent"; 
            delBtn.style.color = "#dc3545"; 
            delBtn.style.border = "none";
            delBtn.style.cursor = "pointer";
            delBtn.style.fontWeight = "bold";
            delBtn.style.padding = "0";
            
            delBtn.onclick = async () => {
                if (confirm("Are you sure you want to delete this receipt?")) {
                    const { error: deleteError } = await db.from('receipts').delete().eq('id', receipt.id);
                    if (deleteError) {
                        alert("Could not delete: " + deleteError.message);
                    } else {
                        card.remove(); 
                    }
                }
            };

            actionRow.appendChild(viewLink);
            actionRow.appendChild(delBtn);
            
            card.appendChild(infoRow);
            card.appendChild(actionRow);
            dateList.appendChild(card);
        });

    } catch (err) {
        dateList.innerHTML = `<p style="color: red; text-align:center;">Error: ${err.message}</p>`;
    }
});

// --- 7. VIEW TRIPS MODAL LOGIC ---
const tripViewBtn = document.getElementById('btn-view-trips');
const tripModal = document.getElementById('trip-modal');
const closeTripBtn = document.getElementById('close-trip-modal');
const tripList = document.getElementById('trip-list');

tripViewBtn.addEventListener('click', async () => {
    tripModal.style.display = 'block';
    tripList.innerHTML = '<p style="text-align:center; color:#666;">Loading trips...</p>';

    try {
        const { data, error } = await db
            .from('trips')
            .select('id, date, start_odometer, end_odometer, total_km, toll_amount, has_toll')
            .order('date', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tripList.innerHTML = '<p style="text-align:center; color:#666;">No trips logged yet.</p>';
            return;
        }

        tripList.innerHTML = '';
        
        data.forEach(trip => {
            const dateObj = new Date(trip.date);
            const dateStr = dateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const card = document.createElement('div');
            card.style.backgroundColor = "#fff";
            card.style.border = "1px solid #ddd";
            card.style.borderRadius = "8px";
            card.style.padding = "15px";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";
            
            let tollText = trip.has_toll ? `Toll: $${trip.toll_amount}` : `No Toll`;
            const infoRow = document.createElement('div');
            infoRow.style.display = "flex";
            infoRow.style.justifyContent = "space-between";
            infoRow.innerHTML = `
                <div style="display: flex; flex-direction: column;">
                    <span style="font-size: 1.1rem; color: #333;">🚗 <strong>${dateStr}</strong></span>
                    <span style="font-size: 0.85rem; color: #666; margin-top: 4px;">Odo: ${trip.start_odometer} &rarr; ${trip.end_odometer}</span>
                </div>
                <span style="font-size: 0.95rem; color: #666; text-align: right;"><strong>${trip.total_km} km</strong><br>${tollText}</span>
            `;

            const actionRow = document.createElement('div');
            actionRow.style.display = "flex";
            actionRow.style.justifyContent = "flex-end"; 
            actionRow.style.marginTop = "12px";
            actionRow.style.paddingTop = "12px";
            actionRow.style.borderTop = "1px solid #eee";

            const delBtn = document.createElement('button');
            delBtn.innerHTML = "🗑️ Delete"; 
            delBtn.style.backgroundColor = "transparent"; 
            delBtn.style.color = "#dc3545"; 
            delBtn.style.border = "none";
            delBtn.style.cursor = "pointer";
            delBtn.style.fontWeight = "bold";
            delBtn.style.padding = "0";
            
            delBtn.onclick = async () => {
                if (confirm("Delete this trip?")) {
                    const { error: deleteError } = await db.from('trips').delete().eq('id', trip.id);
                    if (!deleteError) card.remove();
                }
            };

            actionRow.appendChild(delBtn);
            
            card.appendChild(infoRow);
            card.appendChild(actionRow);
            tripList.appendChild(card);
        });

    } catch (err) {
        tripList.innerHTML = `<p style="color: red; text-align:center;">Error: ${err.message}</p>`;
    }
});

// Close Modals logic
closeBtn.addEventListener('click', () => modal.style.display = 'none');
closeTripBtn.addEventListener('click', () => tripModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === tripModal) tripModal.style.display = 'none';
});
