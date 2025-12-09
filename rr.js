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

// Modal Elements
const imageModal = document.getElementById('imageModal');
const modalContent = document.getElementById('modalContent');
const pdfModal = document.getElementById('pdfModal');
const pdfViewer = document.getElementById('pdfViewer');
const pdfTitle = document.getElementById('pdfTitle');
const pdfCloseBtn = document.getElementById('pdfCloseBtn');

let data=[], activeRole=null, activeContrib=[], activeCustomer=[], basicView=true; 
let nameIndex=new Map();

// --- General Modal Handlers ---

function closeImageModal() {
    imageModal.classList.remove('visible');
    imageModal.style.display = 'none'; 
}

function closePdfModal() {
    pdfModal.classList.remove('visible');
    pdfModal.style.display = 'none';
    pdfViewer.src = ''; 
}

// Close image modal on click outside content
imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        closeImageModal();
    }
});

// Close PDF modal on backdrop click
pdfModal.addEventListener('click', (e) => {
    if (e.target === pdfModal) {
        closePdfModal();
    }
});

// Close PDF modal via button
pdfCloseBtn.onclick = closePdfModal;

// Close any modal on Escape key press
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (imageModal.classList.contains('visible')) {
            closeImageModal();
        }
        if (pdfModal.classList.contains('visible')) {
            closePdfModal();
        }
    }
});

// --- R&R Button Click Handler ---
function handleRRButtonClick(employeeCode, employeeName) {
    closeImageModal();
    // Standardize code to lowercase for robust file fetching
    const code = employeeCode.toLowerCase();
    const pdfUrl = `R&R/${code}.pdf`; 
    pdfTitle.textContent = `R&R Document: ${employeeName} (${employeeCode})`;
    pdfViewer.src = pdfUrl;
    pdfModal.classList.add('visible');
    pdfModal.style.display = 'flex';
}

// --- DWM/KPI Activities Logic ---
function openActivitiesViewer(employeeCode, employeeName, activityType) {
    closeImageModal();
    // 🌟 CORRECTED LINE: Ensures the folder name is capitalized (DWM or KPI)
    const folder = activityType.toUpperCase(); 
    const code = employeeCode.toLowerCase(); 
    const pdfUrl = `${folder}/${code}.pdf`; 
    pdfTitle.textContent = `${activityType} Activities: ${employeeName} (${employeeCode})`;
    pdfViewer.src = pdfUrl;
    pdfModal.classList.add('visible');
    pdfModal.style.display = 'flex';
}


// --- Image Click Logic ---
function attachPreview(imgEl, emp){
    
    imgEl.addEventListener('click', () => { 
        if (pdfModal.classList.contains('visible')) {
            return;
        }

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
  const res = await fetch('Data.json');
  data = await res.json();
  data.sort((a, b) => {
    const roleA = (a.ROLES || '').toUpperCase();
    const roleB = (b.ROLES || '').toUpperCase();
    const rankA = customRoleOrder[roleA] || 999;
    const rankB = customRoleOrder[roleB] || 999;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

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
  buildFilters();
  render();
}
function buildFilters(){
  // Roles (Single Select)
  const roles=[...new Set(data.map(d=>d.ROLES).filter(Boolean))];
  roleFiltersDiv.innerHTML='';
  roles.forEach(r=>{
    const b=document.createElement('button'); b.className='filter-btn'; b.textContent=r;
    b.onclick=()=>{ activeRole = activeRole===r?null:r; updateUI(); render(); };
    roleFiltersDiv.appendChild(b);
  });

  // Contribution (Multi Select)
  const contribs=[...new Set(data.flatMap(d=>d.CHILDREN.map(c=>c['SALES ACTIVITIES CONTRIBUTION']).filter(Boolean)))];
  contribFiltersDiv.innerHTML='';
  contribs.forEach(c=>{
    const b=document.createElement('button'); b.className='filter-btn'; b.textContent=c;
    b.onclick=()=>{ 
      toggleSelection(activeContrib, c);
      updateUI(); 
      render(); 
    };
    contribFiltersDiv.appendChild(b);
  });

  // Customers (Multi Select)
  const custSet=new Set();
  data.forEach(d=>{
    d.CUSTOMER.forEach(c=>{
      c.split(/[\/,;\|]+/).map(x=>x.trim()).filter(Boolean).forEach(s=>custSet.add(s));
    });
  });
  customerFiltersDiv.innerHTML='';
  Array.from(custSet).sort().forEach(c=>{
    const b=document.createElement('button'); b.className='filter-btn'; b.textContent=c;
    b.onclick=()=>{ 
      toggleSelection(activeCustomer, c);
      updateUI(); 
      render(); 
    };
    customerFiltersDiv.appendChild(b);
  });

  updateUI();
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
function render(){
  const q = filterInput.value.trim().toLowerCase();
  let visible = data.slice();
  
  // Apply filters...
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
  
  // Apply text search filter
  if(q) visible = visible.filter(d=>{
    const top = (d.EMPLOYEE_NAME+' '+d.EMPLOYEE_CODE+' '+d.ROLES+' '+(d.DEPARTMENT||'')).toLowerCase();
    const auth = d.AUTHORITIES.some(a=>a.toLowerCase().includes(q));
    const child = d.CHILDREN.some(c=>((c.RESPONSIBILITIES||'')+' '+(c['SALES ACTIVITIES CONTRIBUTION']||'')).toLowerCase().includes(q));
    const cust = d.CUSTOMER.some(c=>c.toLowerCase().includes(q));
    return top.includes(q)||auth||child||cust;
  });

  contentArea.innerHTML='';
  if(!visible.length){ contentArea.innerHTML='<p>No matching records found.</p>'; return; }

  visible.forEach(emp=>{
    const card=document.createElement('div'); card.className='employee-card';
    const top=document.createElement('div'); top.className='employee-top';
    
    const imgURL = emp.EMPLOYEE_IMAGE;

    if (imgURL) {
        const img = document.createElement('img'); 
        img.src = imgURL; 
        img.alt = emp.EMPLOYEE_NAME;
        attachPreview(img, emp); 
        top.append(img); 
    }

    const meta=document.createElement('div'); meta.className='meta';
    
    meta.innerHTML = `<h3>${emp.EMPLOYEE_NAME}</h3><div class="code">${emp.EMPLOYEE_CODE||''}</div><small>${emp.ROLES||''}</small>`; 
    top.append(meta); 
    
    // --- Button Creation Block (Moved inside employee-top) ---
    const hasDetails = emp.AUTHORITIES.length > 0 || emp.CHILDREN.length > 0;
    
    if (hasDetails) {
        // Create the container for the action buttons
        const actionContainer = document.createElement('div');
        actionContainer.className = 'employee-actions-top'; // Styles defined in CSS

        // 1. R&R Button 
        const rrBtn = document.createElement('button');
        rrBtn.id = `rr-button-${emp.EMPLOYEE_CODE}`;
        rrBtn.className = 'action-document-btn'; // Unified class
        rrBtn.textContent = 'R&R, Skill Matrix';
        rrBtn.onclick = () => handleRRButtonClick(emp.EMPLOYEE_CODE, emp.EMPLOYEE_NAME); 
        actionContainer.appendChild(rrBtn);

        // 2. DWM Button
        const dwmBtn = document.createElement('button');
        dwmBtn.className = 'action-document-btn'; // Unified class
        dwmBtn.textContent = 'DWM Activities';
        dwmBtn.onclick = () => openActivitiesViewer(emp.EMPLOYEE_CODE, emp.EMPLOYEE_NAME, 'DWM'); 
        actionContainer.appendChild(dwmBtn);

        // 3. KPI Button
        const kpiBtn = document.createElement('button');
        kpiBtn.className = 'action-document-btn'; // Unified class
        kpiBtn.textContent = 'KPI Activities';
        kpiBtn.onclick = () => openActivitiesViewer(emp.EMPLOYEE_CODE, emp.EMPLOYEE_NAME, 'KPI');
        actionContainer.appendChild(kpiBtn);

        // Append the action container to the employee-top section
        top.appendChild(actionContainer);
    }
    // --- End Button Creation Block ---
    
    card.appendChild(top); // Append the fully constructed 'top' section

    // --- Remaining Sections (These follow the top section/buttons) ---

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
    
    // Full view sections (Only shown when basicView is false)
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


    contentArea.appendChild(card);
  });
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
  render();
};
viewToggleBtn.innerHTML = basicView ? 'Basic' : 'Expanded';
clearBtn.onclick = ()=>{ 
  activeRole=null; 
  activeContrib=[]; 
  activeCustomer=[]; 
  filterInput.value=''; 
  updateUI(); 
  render(); 
};
clearRoleBtn.onclick = ()=>{ activeRole=null; updateUI(); render(); };
clearCustomerBtn.onclick = ()=>{ activeCustomer=[]; updateUI(); render(); };
clearContribBtn.onclick = ()=>{ activeContrib=[]; updateUI(); render(); };


document.addEventListener('DOMContentLoaded', ()=>{
    closeImageModal();
    closePdfModal(); 
}); 

filterInput.addEventListener('input',()=>{ updateUI(); render(); });

/* *** START: JAVASCRIPT LOGIC FOR OGC BUTTON ***
    (This should ideally be moved into your rr.js file)
*/
document.addEventListener('DOMContentLoaded', () => {
    // Select the elements
    const ogcBtn = document.getElementById('ogcFloatingBtn');
    const pdfModal = document.getElementById('pdfModal');
    const pdfViewer = document.getElementById('pdfViewer');
    const pdfTitle = document.getElementById('pdfTitle');
    const pdfCloseBtn = document.getElementById('pdfCloseBtn');
    
    // Function to close the modal (centralized function for reuse)
    const closeModal = () => {
        if (pdfModal && pdfViewer) {
            pdfModal.style.display = 'none';
            pdfViewer.src = ''; // Clear source to stop memory usage
        }
    };
    
    // Logic to handle opening the OGC PDF
    if (ogcBtn && pdfModal && pdfViewer) {
        ogcBtn.addEventListener('click', () => {
            // 1. Set the source to the OGC file
            pdfViewer.src = './OGC/OGC.pdf';
            
            // 2. Update the Title Bar 
            if(pdfTitle) pdfTitle.textContent = "OGC Document";

            // 3. Show the existing modal (using 'flex' to match typical modal centering)
            pdfModal.style.display = 'flex'; 
        });
    }

    // --- MOUSE/TOUCH-BASED CLOSING ---

    // 1. Close modal using the 'x' button
    if (pdfCloseBtn) {
        pdfCloseBtn.addEventListener('click', closeModal);
    }

    // 2. Close modal when clicking the dark background (backdrop)
    window.addEventListener('click', (event) => {
        if (event.target === pdfModal) {
            closeModal();
        }
    });
    
    // --- KEYBOARD-BASED CLOSING (NEW FEATURE) ---
    
    /**
     * This logic handles closing the modal when the ESC key is pressed.
     * This improves accessibility for keyboard users.
     */
    document.addEventListener('keydown', (event) => {
        // Check if the modal is currently visible AND the key pressed is the Escape key
        if (pdfModal.style.display === 'flex' && event.key === 'Escape') {
            closeModal();
        }
    });

    // NOTE: Your existing code in rr.js will likely handle other functionality (filters, basic/detailed view toggle, etc.)
});
/* *** END: JAVASCRIPT LOGIC FOR OGC BUTTON ***
*/
loadJSON();