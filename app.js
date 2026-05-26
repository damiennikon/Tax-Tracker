// Initialize Supabase (You will get these from your Supabase Dashboard later)
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
    e.preventDefault(); // Stops the page from refreshing
    
    const startOdo = parseInt(document.getElementById('start-odo').value);
    const endOdo = parseInt(document.getElementById('end-odo').value);
    const hasToll = tollCheckbox.checked;
    const tollAmount = hasToll ? parseFloat(tollAmountInput.value) : null;
    
    if (endOdo <= startOdo) {
        alert("End odometer must be greater than start.");
        return;
    }

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

    if (error) alert("Error saving trip: " + error.message);
    else {
        alert("Trip saved successfully!");
        e.target.reset(); // Clears the form
        tollContainer.style.display = 'none';
    }
});

// --- Database Logic: Upload Receipt ---
document.getElementById('receipt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const merchant = document.getElementById('merchant').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) return;
    
    // Change button text so you know it's working
    const submitBtn = e.target.querySelector('button');
    submitBtn.innerText = 'Uploading...';

    // 1. Upload file to Supabase Storage (assuming bucket is named 'receipts')
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    // Creates a folder path like: Parking/1684920392.jpg
    const filePath = `${category.replace(/\s+/g, '')}/${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);

    if (uploadError) {
        alert("Upload failed: " + uploadError.message);
        submitBtn.innerText = 'Upload & Save';
        return;
    }

    // 2. Ask Supabase for the direct link to the image we just uploaded
    const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

    // 3. Save the record and the image link to the Database
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

    if (dbError) alert("Error saving record: " + dbError.message);
    else {
        alert("Receipt uploaded and logged!");
        e.target.reset();
    }
    
    submitBtn.innerText = 'Upload & Save';
});
