# frappe/frappe/utils/doctype_files.py
import frappe
import os
import json


@frappe.whitelist()
def check_existing_banner_code(doctypes):
    """Check which doctypes already have banner/footer code"""
    if isinstance(doctypes, str):
        doctypes = json.loads(doctypes)
    
    results = {}
    
    for doctype in doctypes:
        try:
            doc = frappe.get_doc("DocType", doctype)
            module_name = doc.module
            base_path = frappe.get_app_path("frappe")
            
            doctype_folder = os.path.join(
                base_path,
                frappe.scrub(module_name),
                "doctype",
                frappe.scrub(doctype)
            )
            
            # Check list JS
            list_js_path = os.path.join(doctype_folder, f"{frappe.scrub(doctype)}_list.js")
            has_list_banner = False
            if os.path.exists(list_js_path):
                with open(list_js_path, 'r') as f:
                    content = f.read()
                    has_list_banner = 'custom-smart-banner' in content
            
            # Check form JS
            form_js_path = os.path.join(doctype_folder, f"{frappe.scrub(doctype)}.js")
            has_form_banner = False
            if os.path.exists(form_js_path):
                with open(form_js_path, 'r') as f:
                    content = f.read()
                    has_form_banner = 'custom-form-banner' in content
            
            results[doctype] = {
                'has_list_banner': has_list_banner,
                'has_form_banner': has_form_banner,
                'has_any': has_list_banner or has_form_banner
            }
            
        except Exception as e:
            results[doctype] = {
                'has_list_banner': False,
                'has_form_banner': False,
                'has_any': False,
                'error': str(e)
            }
    
    return results

@frappe.whitelist()
def create_doctype_js_files(doctypes, banner_config, force_overwrite=False):
    """
    Creates or updates JavaScript files for doctypes with banner and footer code
    Added force_overwrite parameter to control behavior
    """
    if isinstance(doctypes, str):
        doctypes = json.loads(doctypes)
    if isinstance(banner_config, str):
        banner_config = json.loads(banner_config)
    if isinstance(force_overwrite, str):
        force_overwrite = json.loads(force_overwrite)
    
    results = []
    
    for doctype in doctypes:
        try:
            doc = frappe.get_doc("DocType", doctype)
            module_name = doc.module
            base_path = frappe.get_app_path("frappe")
            
            doctype_folder = os.path.join(
                base_path,
                frappe.scrub(module_name),
                "doctype",
                frappe.scrub(doctype)
            )
            
            if not os.path.exists(doctype_folder):
                os.makedirs(doctype_folder)
            
            # Check if files already have banner code
            list_js_path = os.path.join(doctype_folder, f"{frappe.scrub(doctype)}_list.js")
            form_js_path = os.path.join(doctype_folder, f"{frappe.scrub(doctype)}.js")
            
            # Check existing content
            list_has_banner = False
            if os.path.exists(list_js_path):
                with open(list_js_path, 'r') as f:
                    list_has_banner = 'custom-smart-banner' in f.read()
            
            form_has_banner = False
            if os.path.exists(form_js_path):
                with open(form_js_path, 'r') as f:
                    form_has_banner = 'custom-form-banner' in f.read()
            
            # Skip if already has banner and not forcing overwrite
            if (list_has_banner or form_has_banner) and not force_overwrite:
                results.append({
                    "doctype": doctype,
                    "status": "skipped",
                    "message": "Already has banner code"
                })
                continue
            
            # Generate the JavaScript code
            list_js_content = generate_list_js_code(doctype, banner_config)
            form_js_content = generate_form_js_code(doctype, banner_config)
            
            # Write list JS
            if force_overwrite or not list_has_banner:
                with open(list_js_path, 'w') as f:
                    f.write(list_js_content)
            
            # Write form JS
            if force_overwrite or not form_has_banner:
                if os.path.exists(form_js_path) and not form_has_banner:
                    # Inject into existing file
                    with open(form_js_path, 'r') as f:
                        existing_content = f.read()
                    updated_content = inject_banner_into_existing_js(existing_content, doctype, banner_config)
                    with open(form_js_path, 'w') as f:
                        f.write(updated_content)
                else:
                    # Create new or overwrite
                    with open(form_js_path, 'w') as f:
                        f.write(form_js_content)
            
            results.append({
                "doctype": doctype,
                "status": "success",
                "list_js": list_js_path,
                "form_js": form_js_path,
                "updated_list": force_overwrite or not list_has_banner,
                "updated_form": force_overwrite or not form_has_banner
            })
            
        except Exception as e:
            results.append({
                "doctype": doctype,
                "status": "error",
                "error": str(e)
            })
    
    frappe.clear_cache()
    return results





def generate_list_js_code(doctype, config):
    """Generate complete list view JavaScript code with banner and footer"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    
    return f"""// Auto-generated Banner & Footer for {doctype} List View
frappe.listview_settings['{doctype}'] = frappe.listview_settings['{doctype}'] || {{}};

$.extend(frappe.listview_settings['{doctype}'], {{
    onload: function(listview) {{
        addBannerTo{clean_doctype}ListView();
        addFooterTo{clean_doctype}ListView();
    }},
    refresh: function(listview) {{
        if (!$('.custom-smart-banner').length) {{
            addBannerTo{clean_doctype}ListView();
        }}
        if (!$('.custom-list-footer').length) {{
            addFooterTo{clean_doctype}ListView();
        }}
    }}
}});

function addBannerTo{clean_doctype}ListView() {{
    frappe.after_ajax(() => {{
        $('.page-head h1.page-title').hide();
        $('.list-header h3').hide();
        $('.custom-smart-banner').remove();
        
        const count = cur_list.data.length || $('.list-row').length;
        const doctypeName = cur_list.doctype || '{doctype}';
        
        frappe.db.count(doctypeName).then(total => {{
            $('.count-badge-{clean_doctype}').html(`${{count}} of ${{total}} ${{doctypeName}}s`);
        }});
        
        const banner = `
            <div class="custom-smart-banner" style="
                background: {config.get('gradient', 'linear-gradient(90deg, #2d6eaf, #51a8f9)')};
                color: white;
                padding: 20px 24px;
                font-size: 18px;
                font-weight: 600;
                border-radius: 8px;
                margin: 15px 0 20px 0;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <i class="fa {config.get('icon', 'fa-list')}" style="margin-right: 12px; font-size: 24px;"></i>
                        {config.get('title', 'Smart Overview:')} ${{doctypeName}}
                    </div>
                    <div>
                        <span class="badge badge-light count-badge-{clean_doctype}" style="font-size: 14px; padding: 6px 12px;">
                            ${{count}} ${{doctypeName}}s
                        </span>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes slideIn {{
                    from {{ opacity: 0; transform: translateY(-20px); }}
                    to {{ opacity: 1; transform: translateY(0); }}
                }}
                [data-doctype="{doctype}"] .list-header h3 {{
                    display: none !important;
                }}
            </style>
        `;
        
        const mainSection = cur_list.$page.find('.layout-main-section');
        if (mainSection.length) {{
            mainSection.prepend(banner);
        }}
    }});
}}

function addFooterTo{clean_doctype}ListView() {{
    frappe.after_ajax(() => {{
        $('.custom-list-footer').remove();
        
        const footer = `
            <div class="custom-list-footer" style="
                background: linear-gradient(90deg, #f8f9fa, #e9ecef);
                border-top: 2px solid #2d6eaf;
                padding: 20px 24px;
                margin: 20px 0 0 0;
                border-radius: 8px;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
            ">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="{config.get('logo_path', '/files/logo.png')}" alt="Company Logo" style="height: 40px; width: auto;">
                        <div>
                            <div style="font-size: 14px; color: #666; font-weight: 500;">
                                Powered by {config.get('company_name', 'Your Company')}
                            </div>
                            <div style="font-size: 12px; color: #999;">
                                © ${{new Date().getFullYear()}} All rights reserved
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; align-items: center;">
                        <button class="btn btn-sm btn-default" onclick="frappe.set_route('List', '{doctype}', {{}})">
                            <i class="fa fa-refresh"></i> Refresh
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="frappe.new_doc('{doctype}')">
                            <i class="fa fa-plus"></i> New {doctype}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const mainSection = cur_list.$page.find('.layout-main-section');
        if (mainSection.length) {{
            mainSection.append(footer);
        }}
    }});
}}
"""

def generate_form_js_code(doctype, config):
    """Generate complete form view JavaScript code"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    
    return f"""frappe.ui.form.on('{doctype}', {{
    onload: function(frm) {{
        add{clean_doctype}BannerToForm(frm);
        add{clean_doctype}FooterToForm(frm);
    }},
    refresh: function(frm) {{
        add{clean_doctype}BannerToForm(frm);
        add{clean_doctype}FooterToForm(frm);
    }}
}});

function add{clean_doctype}BannerToForm(frm) {{
    $('.custom-form-banner').remove();
    
    const itemName = frm.doc.name || 'New ' + frm.doctype;
    const isNew = frm.is_new();
    
    let statusBadge = '';
    if (!isNew) {{
        if (frm.doc.hasOwnProperty('enabled')) {{
            const enabled = frm.doc.enabled;
            statusBadge = `<span class="badge badge-${{enabled ? 'success' : 'danger'}}" style="font-size: 14px; padding: 6px 12px;">${{enabled ? 'Active' : 'Disabled'}}</span>`;
        }} else if (frm.doc.hasOwnProperty('disabled')) {{
            const enabled = !frm.doc.disabled;
            statusBadge = `<span class="badge badge-${{enabled ? 'success' : 'danger'}}" style="font-size: 14px; padding: 6px 12px;">${{enabled ? 'Active' : 'Disabled'}}</span>`;
        }}
    }}
    
    const banner = `
        <div class="custom-form-banner" style="
            background: {config.get('gradient', 'linear-gradient(90deg, #2d6eaf, #51a8f9)')};
            color: white;
            padding: 20px 24px;
            font-size: 18px;
            font-weight: 600;
            border-radius: 8px;
            margin: -5px -20px 20px -20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; align-items: center;">
                    <i class="fa {config.get('icon', 'fa-list')}" style="margin-right: 12px; font-size: 24px;"></i>
                    <div>
                        <div style="font-size: 20px; font-weight: 600;">
                            ${{isNew ? 'Create New {doctype}' : itemName}}
                        </div>
                        ${{!isNew ? '<div style="font-size: 14px; opacity: 0.9; margin-top: 2px;">{doctype} Configuration</div>' : ''}}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${{statusBadge}}
                    ${{!isNew ? `<button class="btn btn-light btn-sm" onclick="cur_frm.print_doc()"><i class="fa fa-print"></i> Print</button>` : ''}}
                </div>
            </div>
        </div>
    `;
    
    $(frm.wrapper).find('.layout-main-section').prepend(banner);
}}

function add{clean_doctype}FooterToForm(frm) {{
    $('.custom-form-footer').remove();
    
    const isNew = frm.is_new();
    
    const footer = `
        <div class="custom-form-footer" style="
            background: linear-gradient(90deg, #f8f9fa, #e9ecef);
            border-top: 2px solid #2d6eaf;
            padding: 24px;
            margin: 20px -20px -20px -20px;
            border-radius: 0 0 8px 8px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
        ">
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;">
                <div style="display: flex; align-items: center; gap: 20px;">
                    <img src="{config.get('logo_path', '/files/logo.png')}" alt="Company Logo" style="height: 45px; width: auto;">
                    <div>
                        <div style="font-size: 16px; color: #2d6eaf; font-weight: 600;">
                            {config.get('company_name', 'Your Company')}
                        </div>
                        <div style="font-size: 13px; color: #666;">
                            Enterprise Management System
                        </div>
                        <div style="font-size: 11px; color: #999; margin-top: 2px;">
                            © ${{new Date().getFullYear()}} All rights reserved
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                    ${{!isNew ? `
                        <div style="font-size: 12px; color: #666; text-align: right;">
                            <div>Last Modified: ${{frappe.datetime.prettyDate(frm.doc.modified)}}</div>
                            <div>By: ${{frm.doc.modified_by}}</div>
                        </div>
                    ` : ''}}
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-sm btn-default" onclick="frappe.set_route('List', '{doctype}')">
                            <i class="fa fa-list"></i> Back to List
                        </button>
                        ${{!isNew ? `<button class="btn btn-sm btn-info" onclick="frappe.new_doc('{doctype}')"><i class="fa fa-plus"></i> New {doctype}</button>` : ''}}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $(frm.wrapper).find('.layout-main-section').append(footer);
}}
"""

def inject_banner_into_existing_js(existing_content, doctype, config):
    """Inject banner code into existing JavaScript file"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    
    # Check if the file already has frappe.ui.form.on
    if f"frappe.ui.form.on('{doctype}'," in existing_content:
        # Find the position to inject our code
        lines = existing_content.split('\n')
        new_lines = []
        inside_form_on = False
        brace_count = 0
        
        for i, line in enumerate(lines):
            new_lines.append(line)
            
            if f"frappe.ui.form.on('{doctype}'," in line:
                inside_form_on = True
            
            if inside_form_on:
                brace_count += line.count('{') - line.count('}')
                
                # Inject after onload if it exists
                if 'onload:' in line and 'function' in line:
                    # Find the end of onload function
                    j = i + 1
                    func_brace_count = 1
                    while j < len(lines) and func_brace_count > 0:
                        func_brace_count += lines[j].count('{') - lines[j].count('}')
                        j += 1
                    
                    # Insert our banner call before the closing brace
                    if j > 0:
                        indent = '\t\t'
                        new_lines.insert(len(new_lines) - 1, f"{indent}add{clean_doctype}BannerToForm(frm);")
                        new_lines.insert(len(new_lines) - 1, f"{indent}add{clean_doctype}FooterToForm(frm);")
                
                if brace_count == 0:
                    inside_form_on = False
        
        # Add our banner functions at the end
        new_lines.extend([
            '',
            f'// Auto-generated Banner and Footer Functions',
            generate_banner_functions(doctype, config)
        ])
        
        return '\n'.join(new_lines)
    else:
        # No existing form handler, add complete new code
        return existing_content + '\n\n' + generate_form_js_code(doctype, config)

def generate_banner_functions(doctype, config):
    """Generate just the banner and footer functions"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    return f"""
function add{clean_doctype}BannerToForm(frm) {{
    // Banner implementation
    $('.custom-form-banner').remove();
    // ... rest of banner code
}}

function add{clean_doctype}FooterToForm(frm) {{
    // Footer implementation
    $('.custom-form-footer').remove();
    // ... rest of footer code
}}"""
