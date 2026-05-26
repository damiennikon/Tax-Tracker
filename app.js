// --- 1. GLOBAL ERROR CATCHER ---
// This will force mobile browsers to display background crashes on the screen
window.onerror = function(message, source, lineno, colno, error) {
    alert(`CRASH ON LINE ${lineno}:\n${message}`);
    return true; 
};
window.addEventListener("unhandledrejection", function(event) {
    alert(`BACKGROUND CRASH:\n${event.reason.message || event.reason}`);
});

// --- 2. INITIALIZE SUPABASE ---
// WARNING: Ensure you do not accidentally delete the single quotes (' ') wrapping the text!
const SUPABASE_URL = 'https://rkolzqzlbvmxdduxqccv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_imJk5ynv3BYbo6QGrw2jMA_jePw2sZb';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

    const { error } = await supabase
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

    // Upload file to Storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${category.replace(/\s+/g, '')}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

    if (uploadError) {
        alert("Upload failed: " + uploadError.message);
        submitBtn.innerText = 'Upload & Save';
        return;
    }

    // Get direct link
    const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

    // Save database record
    const { error: dbError } = await supabase
        .from('receipts')
        .insert([{
            date: new Date().toISOString(),
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

// Open modal and fetch data
viewBtn.addEventListener('click', async () => {
    modal.style.display = 'block';
    dateList.innerHTML = '<p style="text-align:center; color:#666;">Loading dates...</p>';

    try {
        const { data, error } = await supabase
            .from('receipts')
            .select('date, merchant, file_url, amount')
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
            item.style.justifyContent = "space-between";
            item.style.alignItems = "center";

            item.innerHTML = `
                <span style="font-size: 1.1rem;">📅 <strong>${dateStr}</strong></span> 
                <span style="font-size: 0.9rem; color: #666; text-align: right;">${receipt.merchant}<br>$${receipt.amount}</span>
            `;
            dateList.appendChild(item);
        });

    } catch (err) {
        dateList.innerHTML = `<p style="color: red; text-align:center;">Error: ${err.message}</p>`;
    }
});

// Close modal logic
closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// --- 7. HEALTH CHECK ---
// If you see this pop-up, the script loaded perfectly without crashing!
alert("App logic loaded successfully!");
