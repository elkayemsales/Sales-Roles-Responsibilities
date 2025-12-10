const sidebarBtn = document.getElementById('sidebarToggleBtn');
const sidebar = document.getElementById('sidebar');
const contentArea = document.getElementById('contentArea');
const roleFiltersDiv = document.getElementById('roleFilters');
const contribFiltersDiv = document.getElementById('contribFilters');
const customerFiltersDiv = document.getElementById('customerFilters');
const filterInput = document.getElementById('filterInput');
const clearBtn = document.getElementById('clearFilterBtn'); 
const clearRoleBtn = document.getElementById('clearRoleBtn');
const clearCustomerBtn = document.getElementById('clearCustomerBtn');
const clearContribBtn = document.getElementById('clearContribBtn');
const backToTop = document.getElementById('backToTop');
const viewToggleBtn = document.getElementById('viewToggleBtn');
const main = document.getElementById('main');
const loadingSkeleton = document.getElementById('loadingSkeleton'); // ADVANCED: New Element

// Modal Elements
const imageModal = document.getElementById('imageModal');
const modalContent = document.getElementById('modalContent');
const pdfModal = document.getElementById('pdfModal');
const pdfViewer = document.getElementById('pdfViewer');
const pdfTitle = document.getElementById('pdfTitle');
const pdfCloseBtn = document.getElementById('pdfCloseBtn');
const ogcBtn = document.getElementById('ogcFloatingBtn');

// ADVANCED: Global state variables initialized from URL or defaults
let data = [], allRoles = [], allCustomers = [], allContribs = [];
let activeRole = null, activeContrib = [], activeCustomer = [], basicView = true; 
let nameIndex = new Map();

// --- ADVANCED: URL STATE MANAGEMENT ---

function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    activeRole = params.get('role') || null;
    filterInput.value = params.get('q') || '';
    basicView = params.get('view') === 'expanded' ? false : true;
    
    // Multi-select arrays
    activeCustomer = params.get('cust') ? params.get('cust').split(',') : [];
    activeContrib = params.get('contrib') ? params.get('contrib').split(',') : [];

    viewToggleBtn.innerHTML = basicView ? 'Basic' : 'Expanded';
}

function updateURL(replace = false) {
    const params = new URLSearchParams();
    if (activeRole) params.set('role', activeRole);
    if (filterInput.value.trim()) params.set('q', filterInput.value.trim());
    if (!basicView) params.set('view', 'expanded');
    if (activeCustomer.length) params.set('cust', activeCustomer.join(','));
    if (activeContrib.length) params.set('contrib', activeContrib.join(','));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    if (replace) {
        window.history.replaceState({ path: newUrl }, '', newUrl);
    } else {
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
}

// Listen for back/forward browser buttons
window.onpopstate = () => {
    loadStateFromURL();
    updateUI();
    render();
};

// --- FILE EXISTENCE CHECK (Optimized for reuse) ---
async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

// --- General Modal Handlers (Unchanged) ---

function closeImageModal() {
    imageModal.classList.remove('visible');
    imageModal.style.display = 'none'; 
}

function closePdfModal() {
    pdfModal.classList.remove('visible');
    pdfModal.style.display = 'none';
    pdfViewer.src = ''; 
}

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) closeImageModal();
});
pdfModal.addEventListener('click', (e) => {
    if (e.target === pdfModal) closePdfModal();
});
pdfCloseBtn.onclick = closePdfModal;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (imageModal.classList.contains('visible')) closeImageModal();
        if (pdfModal.classList.contains('visible')) closePdfModal();
    }
});

function handleRRButtonClick(employeeCode, employeeName) {
    closeImageModal();
    const code = employeeCode.toLowerCase();
    const pdfUrl = `R&R/${code}.pdf`; 
    pdfTitle.textContent = `R&R Document: ${employeeName} (${employeeCode})`;
    pdfViewer.src = pdfUrl;
    pdfModal.classList.add('visible');
    pdfModal.style.display = 'flex';
}

function openActivitiesViewer(employeeCode, employeeName, activityType) {
    closeImageModal();
    const folder = activityType.toUpperCase(); 
    const code = employeeCode.toLowerCase(); 
    const pdfUrl = `${folder}/${code}.pdf`; 
    pdfTitle.textContent = `${activityType} Activities: ${employeeName} (${employeeCode})`;
    pdfViewer.src = pdfUrl;
    pdfModal.classList.add('visible');
    pdfModal.style.display = 'flex';
}

function attachPreview(imgEl, emp){ 
    imgEl.addEventListener('click', () => { 
        if (pdfModal.classList.contains('visible')) return;
        modalContent.src = imgEl.src;
        imageModal.classList.add('visible');
        imageModal.style.display = 'flex';
    });
}

// --- Data Loading and Filtering ---

const customRoleOrder = {
    'HEAD OF THE DEPARTMENT': 1,
    'SR.OFFICER': 2,
    'OFFICER': 3,
    'JR.OFFICER': 4,
    'OPERATOR': 5,
    'AD.OPERATOR': 6,
    'AD.TRAINEE': 7
};

async function loadJSON(){
    loadingSkeleton.style.display = 'flex'; // Show loading feedback
    
    const res = await fetch('Data.json');
    data = await res.json();
    data.sort((a, b) => {
        const roleA = (a.ROLES || '').toUpperCase();
        const roleB = (b.ROLES || '').toUpperCase();
        const rankA = customRoleOrder[roleA] || 999;
        const rankB = customRoleOrder[roleB] || 999;
        if (rankA !== rankB) return rankA - rankB;
        const codeA = (a.EMPLOYEE_CODE || '').toUpperCase();
        const codeB = (b.EMPLOYEE_CODE || '').toUpperCase();
        if (codeA < codeB) return -1;
        if (codeA > codeB) return 1;
        return 0;
    });

    data.forEach(d=>{
        if(!Array.isArray(d.AUTHORITIES)) d.AUTHORITIES = d.AUTHORITIES ? [d.AUTHORITIES] : [];
        if(!Array.isArray(d.CHILDREN)) d.CHILDREN = d.CHILDREN||[];
        if(!Array.isArray(d.CUSTOMER)) d.CUSTOMER = d.CUSTOMER ? (Array.isArray(d.CUSTOMER)?d.CUSTOMER:[d.CUSTOMER]) : [];
        nameIndex.set((d.EMPLOYEE_NAME||'').toLowerCase(), d);
    });
    
    // Pre-extract filter options for filter builder
    allRoles = [...new Set(data.map(d=>d.ROLES).filter(Boolean))];
    allContribs = [...new Set(data.flatMap(d=>d.CHILDREN.map(c=>c['SALES ACTIVITIES CONTRIBUTION']).filter(Boolean)))];
    const custSet=new Set();
    data.forEach(d=>{
        d.CUSTOMER.forEach(c=>{
            c.split(/[\/,;\|]+/).map(x=>x.trim()).filter(Boolean).forEach(s=>custSet.add(s));
        });
    });
    allCustomers = Array.from(custSet).sort();
    
    buildFilters();
    
    // ADVANCED: Load state from URL after data is ready, then render
    loadStateFromURL();
    updateUI();
    await render();
    loadingSkeleton.style.display = 'none'; // Hide loading feedback
}

function buildFilters(){
    // Roles (Single Select)
    roleFiltersDiv.innerHTML='';
    allRoles.forEach(r=>{
        const b=document.createElement('button'); b.className='filter-btn'; b.textContent=r;
        b.onclick=()=>{ 
            activeRole = activeRole===r?null:r; 
            updateUI(); 
            updateURL(); // ADVANCED: Update URL on filter change
            render(); 
        };
        roleFiltersDiv.appendChild(b);
    });

    // Contribution (Multi Select)
    contribFiltersDiv.innerHTML='';
    allContribs.forEach(c=>{
        const b=document.createElement('button'); b.className='filter-btn'; b.textContent=c;
        b.onclick=()=>{ 
            toggleSelection(activeContrib, c);
            updateUI(); 
            updateURL(); // ADVANCED: Update URL on filter change
            render(); 
        };
        contribFiltersDiv.appendChild(b);
    });

    // Customers (Multi Select)
    customerFiltersDiv.innerHTML='';
    allCustomers.forEach(c=>{
        const b=document.createElement('button'); b.className='filter-btn'; b.textContent=c;
        b.onclick=()=>{ 
            toggleSelection(activeCustomer, c);
            updateUI(); 
            updateURL(); // ADVANCED: Update URL on filter change
            render(); 
        };
        customerFiltersDiv.appendChild(b);
    });
}

function toggleSelection(arr, item) {
    const index = arr.indexOf(item);
    if (index > -1) {
        arr.splice(index, 1);
    } else {
        arr.push(item);
    }
}

function updateUI(){
    // Update filter button visual states
    [...roleFiltersDiv.children].forEach(b=>b.classList.toggle('active', b.textContent===activeRole));
    [...contribFiltersDiv.children].forEach(b=>b.classList.toggle('active', activeContrib.includes(b.textContent)));
    [...customerFiltersDiv.children].forEach(b=>b.classList.toggle('active', activeCustomer.includes(b.textContent)));
    
    // Update individual clear button states
    clearRoleBtn.disabled = !activeRole;
    clearCustomerBtn.disabled = activeCustomer.length === 0;
    clearContribBtn.disabled = activeContrib.length === 0;

    // Update 'Clear ALL' button state
    const isFilterActive = activeRole || activeCustomer.length > 0 || activeContrib.length > 0 || filterInput.value.trim().length > 0;
    clearBtn.disabled = !isFilterActive;
}

// --- ADVANCED: Optimized Parallel Render ---
async function render(){
    const q = filterInput.value.trim().toLowerCase();
    
    // 1. Filter Data
    let visible = data.slice();
    if(activeRole) visible = visible.filter(d=>d.ROLES===activeRole);
    if(activeContrib.length > 0) {
        visible = visible.filter(d => 
            d.CHILDREN.some(c => activeContrib.includes(c['SALES ACTIVITIES CONTRIBUTION']))
        );
    }
    if(activeCustomer.length > 0) {
        visible = visible.filter(d => 
            d.CUSTOMER.some(citem => 
                citem.split(/[\/,;\|]+/).map(x => x.trim())
                .some(cName => activeCustomer.includes(cName))
            )
        );
    }
    if(q) visible = visible.filter(d=>{
        const top = (d.EMPLOYEE_NAME+' '+d.EMPLOYEE_CODE+' '+d.ROLES+' '+(d.DEPARTMENT||'')).toLowerCase();
        const auth = d.AUTHORITIES.some(a=>a.toLowerCase().includes(q));
        const child = d.CHILDREN.some(c=>((c.RESPONSIBILITIES||'')+' '+(c['SALES ACTIVITIES CONTRIBUTION']||'')).toLowerCase().includes(q));
        const cust = d.CUSTOMER.some(c=>c.toLowerCase().includes(q));
        return top.includes(q)||auth||child||cust;
    });

    contentArea.innerHTML='';
    if(!visible.length){ contentArea.innerHTML='<p>No matching records found.</p>'; return; }

    const buttonsConfig = [
        { type: 'R&R, Skill Matrix', folder: 'R&R', handler: handleRRButtonClick },
        { type: 'DWM Activities', folder: 'DWM', handler: (code, name) => openActivitiesViewer(code, name, 'DWM') },
        { type: 'KPI Activities', folder: 'KPI', handler: (code, name) => openActivitiesViewer(code, name, 'KPI') }
    ];

    // 2. Map and start all card rendering/file checks (concurrently)
    const cardPromises = visible.map(async (emp) => {
        const card = document.createElement('div');
        card.className = 'employee-card';
        
        // --- 2a. Check for documents concurrently ---
        const checks = buttonsConfig.map(async (btnData) => {
            const code = (emp.EMPLOYEE_CODE || '').toLowerCase();
            if (!code) return { btnData, exists: false };
            const folder = btnData.folder.toUpperCase();
            const pdfUrl = `./${folder}/${code}.pdf`;
            const exists = await checkFileExists(pdfUrl);
            return { btnData, exists };
        });
        const results = await Promise.all(checks); // Wait for all checks for *this* employee

        // --- 2b. Build the Card structure (Optimized using Template Literals in a real scenario) ---
        const top = document.createElement('div'); top.className = 'employee-top';
        
        if (emp.EMPLOYEE_IMAGE) {
            const img = document.createElement('img'); 
            img.src = emp.EMPLOYEE_IMAGE; 
            img.alt = emp.EMPLOYEE_NAME;
            attachPreview(img, emp); 
            top.append(img); 
        }

        const meta=document.createElement('div'); meta.className='meta';
        meta.innerHTML = `<h3>${emp.EMPLOYEE_NAME}</h3><div class="code">${emp.EMPLOYEE_CODE||''}</div><small>${emp.ROLES||''}</small>`; 
        top.append(meta); 

        const actionContainer = document.createElement('div');
        actionContainer.className = 'employee-actions-top';
        let buttonsAdded = false;

        results.forEach(result => {
            if (result.exists) {
                const btn = document.createElement('button');
                btn.className = 'action-document-btn';
                btn.textContent = result.btnData.type;
                btn.onclick = () => result.btnData.handler(emp.EMPLOYEE_CODE, emp.EMPLOYEE_NAME);
                actionContainer.appendChild(btn);
                buttonsAdded = true;
            }
        });

        if (buttonsAdded) {
            top.appendChild(actionContainer);
        }
        card.appendChild(top);

        // --- 2c. Customer Follow-up Section ---
        if(emp.CUSTOMER.length){
            const cDiv=document.createElement('div'); cDiv.className='customer-follow';
            cDiv.innerHTML = '<strong>Customer Follow-ups:</strong>';
            emp.CUSTOMER.forEach(citem=>{
                citem.split(/[\/,;\|]+/).map(x=>x.trim()).filter(Boolean).forEach(s=>{
                    const chip=document.createElement('span'); chip.className='customer-chip'; chip.textContent=s; cDiv.appendChild(chip);
                });
            });
            card.appendChild(cDiv);
        }

        // --- 2d. Expanded View Sections ---
        if(!basicView){
            if(emp.AUTHORITIES.length){
                const aDiv=document.createElement('div'); aDiv.className='authorities';
                emp.AUTHORITIES.forEach(a=>{ const chip=document.createElement('div'); chip.className='authority-chip'; chip.textContent=a; aDiv.appendChild(chip); });
                card.appendChild(aDiv);
            }
            if(emp.CHILDREN.length){
                const wrap=document.createElement('div'); wrap.className='children-wrap';
                emp.CHILDREN.forEach(child=>{
                    if(child['SECONDLINE PERSON'] && child['SECONDLINE PERSON'].startsWith('****')) return;
                    const cb=document.createElement('div'); cb.className='child-block';
                    const ctop=document.createElement('div'); ctop.className='child-top';
                    const resp=document.createElement('div'); resp.className='resp'; resp.textContent=child.RESPONSIBILITIES||'—';
                    const contrib=document.createElement('div'); contrib.className='contrib'; contrib.textContent=child['SALES ACTIVITIES CONTRIBUTION']||'';
                    ctop.append(resp, contrib); cb.appendChild(ctop);

                    const secsRaw = (child['SECONDLINE PERSON']||'').split(/[\/,;\|]+/).map(s=>s.trim()).filter(Boolean);
                    if(secsRaw.length){
                        const row=document.createElement('div'); row.className='secondline-row';
                        secsRaw.forEach(sec=>{
                            const m = nameIndex.get((sec||'').toLowerCase());
                            const chip=document.createElement('div'); chip.className='secondline-chip';
                            
                            if(!m || !m.EMPLOYEE_IMAGE){
                                chip.innerHTML = `<div><div class="sname">${sec}</div><div class="smeta" style="color:#c23a3a;font-weight:700;font-size:.84rem;">(No image/data found)</div></div>`;
                            } else {
                                const img2=document.createElement('img'); 
                                img2.src=m.EMPLOYEE_IMAGE; 
                                img2.alt=m.EMPLOYEE_NAME;
                                attachPreview(img2, m); 
                                
                                const txtWrap=document.createElement('div'); txtWrap.style.display='flex'; txtWrap.style.flexDirection='column';
                                const sn=document.createElement('div'); sn.className='sname'; sn.textContent=m.EMPLOYEE_NAME;
                                const scode=document.createElement('div'); scode.className='code'; scode.textContent=m.EMPLOYEE_CODE||'';
                                const sm=document.createElement('div'); sm.className='smeta'; sm.textContent=m.ROLES||'';
                                txtWrap.append(sn, scode, sm);
                                
                                if(m.CUSTOMER && m.CUSTOMER.length){
                                    const custWrap=document.createElement('div'); custWrap.style.marginTop='6px';
                                    m.CUSTOMER.forEach(citem=>{ citem.split(/[\/,;\|]+/).map(x=>x.trim()).filter(Boolean).forEach(s=>{ const cchip=document.createElement('span'); cchip.className='customer-chip'; cchip.textContent=s; custWrap.appendChild(cchip); }); });
                                    txtWrap.appendChild(custWrap);
                                }
                                chip.append(img2, txtWrap);
                            }
                            row.appendChild(chip);
                        });
                        cb.appendChild(row);
                    }
                    wrap.appendChild(cb);
                });
                if(wrap.children.length) card.appendChild(wrap);
            }
        }
        
        return card; // Return the fully built DOM element
    }); 

    // 3. Await all card builds (The entire array of promises)
    const renderedCards = await Promise.all(cardPromises);

    // 4. Append all cards to the DOM once
    contentArea.append(...renderedCards);
}

// --- Event Listeners ---
sidebarBtn.onclick = ()=>{
    sidebar.classList.toggle('open'); 
    main.classList.toggle('shifted');
};

window.addEventListener('scroll',()=>{ backToTop.style.display = window.scrollY>200?'block':'none'; });
backToTop.onclick = ()=>{ window.scrollTo({ top:0, behavior:'smooth' }); };

viewToggleBtn.onclick = ()=>{
    basicView = !basicView;
    viewToggleBtn.innerHTML = basicView ? 'Basic' : 'Expanded';
    updateURL(); // ADVANCED: Update URL
    render();
};

clearBtn.onclick = ()=>{ 
    activeRole=null; 
    activeContrib=[]; 
    activeCustomer=[]; 
    filterInput.value=''; 
    updateUI(); 
    updateURL(); // ADVANCED: Update URL
    render(); 
};

// ADVANCED: Bind filter input and individual clear buttons to update URL
filterInput.addEventListener('input',()=>{ 
    updateUI(); 
    updateURL(true); // Use replaceState for search input
    render(); 
});
clearRoleBtn.onclick = ()=>{ activeRole=null; updateUI(); updateURL(); render(); };
clearCustomerBtn.onclick = ()=>{ activeCustomer=[]; updateUI(); updateURL(); render(); };
clearContribBtn.onclick = ()=>{ activeContrib=[]; updateUI(); updateURL(); render(); };


// --- OGC Button Logic (Moved from DOMContentLoaded) ---
ogcBtn.addEventListener('click', () => {
    closeImageModal();
    pdfViewer.src = './OGC/OGC.pdf';
    pdfTitle.textContent = "Organization Chart Document (OGC)";
    pdfModal.classList.add('visible');
    pdfModal.style.display = 'flex'; 
});


document.addEventListener('DOMContentLoaded', ()=>{
    closeImageModal();
    closePdfModal(); 
    loadJSON(); // Start the advanced loading process
});
