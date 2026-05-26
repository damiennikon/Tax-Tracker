// --- 1. GLOBAL ERROR CATCHER ---
window.onerror = function(message, source, lineno, colno, error) {
    alert(`CRASH ON LINE ${lineno}:\n${message}`);
    return true; 
};
window.addEventListener("unhandledrejection", function(event) {
    alert(`BACKGROUND CRASH:\n${event.reason.message || event.reason}`);
});

// --- 2. INITIALIZE SUPABASE ---
const SUPABASE_URL = 'https://rkolzqzlbvmxdduxqccv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_imJk5ynv3BYbo6QGrw2jMA_jePw2sZb';
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
            date: new Date().toISOString(),
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
            
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.gap = "8px";
            
            const item = document.createElement('a');
            item.href = receipt.file_url;
            item.target = "_blank"; 
            item.style.padding = "15px";
            item.style.backgroundColor = "#f8f9fa";
            item.style.border = "1px solid #dee2e6";
            item.style.borderRadius = "8px";
            item.style.textDecoration = "none";
            item.style.color = "#333";
            item.style.display = "flex";
            item.style.flex = "1";
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";
            item.innerHTML = `
                <span style="font-size: 1rem;">📅 <strong>${dateStr}</strong></span> 
                <span style="font-size: 0.85rem; color: #666; text-align: right;">${receipt.merchant}<br>$${receipt.amount}</span>
            `;

            // FIXED BUTTON SIZE
            const delBtn = document.createElement('button');
            delBtn.innerText = "❌";
            delBtn.style.minWidth = "50px"; 
            delBtn.style.width = "50px"; 
            delBtn.style.flexShrink = "0"; 
            delBtn.style.backgroundColor = "#dc3545"; 
            delBtn.style.color = "white";
            delBtn.style.border = "none";
            delBtn.style.borderRadius = "8px";
            delBtn.style.cursor = "pointer";
            delBtn.style.display = "flex";
            delBtn.style.alignItems = "center";
            delBtn.style.justifyContent = "center";
            delBtn.style.fontSize = "1rem";
            
            delBtn.onclick = async () => {
                if (confirm("Are you sure you want to delete this receipt?")) {
                    const { error: deleteError } = await db.from('receipts').delete().eq('id', receipt.id);
                    if (deleteError) {
                        alert("Could not delete: " + deleteError.message);
                    } else {
                        row.remove(); 
                    }
                }
            };

            row.appendChild(item);
            row.appendChild(delBtn);
            dateList.appendChild(row);
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
            .select('id, date, total_km, toll_amount, has_toll')
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
            
            const row = document.createElement('div');
            row.style.display = "flex";
            row.style.gap = "8px";
            
            const infoBox = document.createElement('div');
            infoBox.style.padding = "15px";
            infoBox.style.backgroundColor = "#f8f9fa";
            infoBox.style.border = "1px solid #dee2e6";
            infoBox.style.borderRadius = "8px";
            infoBox.style.color = "#333";
            infoBox.style.display = "flex";
            infoBox.style.flex = "1";
            infoBox.style.justifyContent = "space-between";
            infoBox.style.alignItems = "center";
            
            let tollText = trip.has_toll ? `Toll: $${trip.toll_amount}` : `No Toll`;
            
            infoBox.innerHTML = `
                <span style="font-size: 1rem;">🚗 <strong>${dateStr}</strong></span> 
                <span style="font-size: 0.85rem; color: #666; text-align: right;">${trip.total_km} km<br>${tollText}</span>
            `;

            // FIXED BUTTON SIZE
            const delBtn = document.createElement('button');
            delBtn.innerText = "❌";
            delBtn.style.minWidth = "50px"; 
            delBtn.style.width = "50px"; 
            delBtn.style.flexShrink = "0"; 
            delBtn.style.backgroundColor = "#dc3545"; 
            delBtn.style.color = "white";
            delBtn.style.border = "none";
            delBtn.style.borderRadius = "8px";
            delBtn.style.cursor = "pointer";
            delBtn.style.display = "flex";
            delBtn.style.alignItems = "center";
            delBtn.style.justifyContent = "center";
            delBtn.style.fontSize = "1rem";
            
            delBtn.onclick = async () => {
                if (confirm("Delete this trip?")) {
                    const { error: deleteError } = await db.from('trips').delete().eq('id', trip.id);
                    if (!deleteError) row.remove();
                }
            };

            row.appendChild(infoBox);
            row.appendChild(delBtn);
            tripList.appendChild(row);
        });

    } catch (err) {
        tripList.innerHTML = `<p style="color: red; text-align:center;">Error: ${err.message}</p>`;
    }
});

// Close Modals
closeBtn.addEventListener('click', () => modal.style.display = 'none');
closeTripBtn.addEventListener('click', () => tripModal.style.display = 'none');

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === tripModal) tripModal.style.display = 'none';
});
