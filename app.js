// Initialize Supabase 
// IMPORTANT: Paste your actual Supabase URL and Key back in here!
const SUPABASE_URL = 'https://rkolzqzlbvmxdduxqccv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_imJk5ynv3BYbo6QGrw2jMA_jePw2sZb';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- UI Logic: Toll Checkbox ---
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

// --- Database Logic: Save Trip ---
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
    }
    
    submitBtn.innerText = originalText;
});

// --- Database Logic: Upload Receipt ---
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

    // 1. Upload file to Supabase Storage
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

    // 2. Ask Supabase for the direct link
    const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

    // 3. Save the record
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
        loadReceipts(); // Update the gallery instantly
    }
    
    submitBtn.innerText = 'Upload & Save';
});

// --- Database Logic: Fetch and Display Receipts ---
async function loadReceipts() {
    const list = document.getElementById('receipt-list');
    
    // Fetch the 5 most recent receipts
    const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);

    if (error) {
        list.innerHTML = '<p style="color: red;">Error loading receipts.</p>';
        return;
    }

    if (data.length === 0) {
        list.innerHTML = '<p style="color: #666;">No receipts yet.</p>';
        return;
    }

    list.innerHTML = '';

    data.forEach(receipt => {
        const item = document.createElement('div');
        item.style.padding = '12px';
        item.style.border = '1px solid #ddd';
        item.style.borderRadius = '8px';
        item.style.backgroundColor = '#fafafa';
        
        // Format to AUD
        const formattedAmount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(receipt.amount);

        item.innerHTML = `
            <strong style="font-size: 1.1rem; color: #333;">${receipt.merchant}</strong> 
            <span style="float: right; font-weight: bold; color: #28a745;">${formattedAmount}</span><br>
            <span style="font-size: 0.85rem; color: #666;">${receipt.category}</span><br>
            <a href="${receipt.file_url}" target="_blank" style="display: inline-block; margin-top: 8px; color: #007bff; text-decoration: none; font-weight: bold;">📄 View Document</a>
        `;
        list.appendChild(item);
    });
}

// --- Database Logic: Fetch and Display Receipts ---
async function loadReceipts() {
    const list = document.getElementById('receipt-list');

    // Failsafe in case the HTML element hasn't loaded
    if (!list) return;

    try {
        // Fetch the 5 most recent receipts
        const { data, error } = await supabase
            .from('receipts')
            .select('*')
            .order('date', { ascending: false })
            .limit(5);

        if (error) {
            // Prints a database rejection to the screen
            list.innerHTML = `<p style="color: red;"><b>Database Error:</b> ${error.message}</p>`;
            return;
        }

        if (!data || data.length === 0) {
            list.innerHTML = '<p style="color: #666;">No receipts yet.</p>';
            return;
        }

        // Clear the loading text
        list.innerHTML = '';

        data.forEach(receipt => {
            const item = document.createElement('div');
            item.style.padding = '12px';
            item.style.border = '1px solid #ddd';
            item.style.borderRadius = '8px';
            item.style.backgroundColor = '#fafafa';
            
            // Safety check in case the amount comes back in a weird format
            const safeAmount = parseFloat(receipt.amount) || 0;
            const formattedAmount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(safeAmount);

            item.innerHTML = `
                <strong style="font-size: 1.1rem; color: #333;">${receipt.merchant || 'Unknown'}</strong> 
                <span style="float: right; font-weight: bold; color: #28a745;">${formattedAmount}</span><br>
                <span style="font-size: 0.85rem; color: #666;">${receipt.category || 'N/A'}</span><br>
                <a href="${receipt.file_url}" target="_blank" style="display: inline-block; margin-top: 8px; color: #007bff; text-decoration: none; font-weight: bold;">📄 View Document</a>
            `;
            list.appendChild(item);
        });

    } catch (err) {
        // Prints a silent Javascript crash directly to the screen
        list.innerHTML = `<p style="color: red;"><b>App Crash:</b> ${err.message}</p>`;
    }
}

// Load the receipts as soon as the app starts
loadReceipts();
