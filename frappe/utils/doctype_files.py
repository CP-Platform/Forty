# frappe/frappe/utils/doctype_files.py
import frappe
import json
from frappe.utils import now_datetime


@frappe.whitelist()
def check_existing_banner_scripts(doctypes):
    """Check which doctypes already have banner/footer client scripts"""
    if isinstance(doctypes, str):
        doctypes = json.loads(doctypes)
    
    results = {}
    
    for doctype in doctypes:
        try:
            # Check for existing client scripts
            list_scripts = frappe.get_all('Client Script', 
                filters={
                    'dt': doctype,
                    'view': 'List',
                    'enabled': 1,
                    'script': ['like', '%custom-smart-banner%']
                },
                limit=1
            )
            
            form_scripts = frappe.get_all('Client Script', 
                filters={
                    'dt': doctype,
                    'view': 'Form',
                    'enabled': 1,
                    'script': ['like', '%custom-form-banner%']
                },
                limit=1
            )
            
            results[doctype] = {
                'has_list_banner': len(list_scripts) > 0,
                'has_form_banner': len(form_scripts) > 0,
                'has_any': len(list_scripts) > 0 or len(form_scripts) > 0
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
def create_banner_client_scripts(doctypes, banner_config, force_overwrite=False):
    """
    Creates Client Script records for doctypes with banner and footer code
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
            # Check existing scripts
            existing_list = frappe.get_all('Client Script', 
                filters={
                    'dt': doctype,
                    'view': 'List',
                    'script': ['like', '%custom-smart-banner%']
                },
                fields=['name', 'enabled'],
                limit=1
            )
            
            existing_form = frappe.get_all('Client Script', 
                filters={
                    'dt': doctype,
                    'view': 'Form',
                    'script': ['like', '%custom-form-banner%']
                },
                fields=['name', 'enabled'],
                limit=1
            )
            
            # Skip if already has scripts and not forcing overwrite
            if (existing_list or existing_form) and not force_overwrite:
                results.append({
                    "doctype": doctype,
                    "status": "skipped",
                    "message": "Already has banner scripts"
                })
                continue
            
            # Create or update List View Script
            list_script_name = None
            if existing_list and force_overwrite:
                # Update existing
                list_script = frappe.get_doc('Client Script', existing_list[0].name)
                list_script.script = generate_list_view_script(doctype, banner_config)
                list_script.save()
                list_script_name = list_script.name
            else:
                # Create new
                list_script = frappe.get_doc({
                    'doctype': 'Client Script',
                    'name': f'{doctype} - List Banner',
                    'dt': doctype,
                    'view': 'List',
                    'enabled': 1,
                    'script': generate_list_view_script(doctype, banner_config)
                })
                list_script.insert()
                list_script_name = list_script.name
            
            # Create or update Form View Script
            form_script_name = None
            if existing_form and force_overwrite:
                # Update existing
                form_script = frappe.get_doc('Client Script', existing_form[0].name)
                form_script.script = generate_form_view_script(doctype, banner_config)
                form_script.save()
                form_script_name = form_script.name
            else:
                # Create new
                form_script = frappe.get_doc({
                    'doctype': 'Client Script',
                    'name': f'{doctype} - Form Banner',
                    'dt': doctype,
                    'view': 'Form',
                    'enabled': 1,
                    'script': generate_form_view_script(doctype, banner_config)
                })
                form_script.insert()
                form_script_name = form_script.name
            
            results.append({
                "doctype": doctype,
                "status": "success",
                "list_script": list_script_name,
                "form_script": form_script_name,
                "updated_list": True,
                "updated_form": True
            })
            
        except Exception as e:
            results.append({
                "doctype": doctype,
                "status": "error",
                "error": str(e)
            })
    
    frappe.db.commit()
    frappe.clear_cache()
    return results


def generate_list_view_script(doctype, config):
    """Generate List View Client Script code"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    
    return f"""// Auto-generated Banner & Footer for {doctype} List View
frappe.listview_settings['{doctype}'] = frappe.listview_settings['{doctype}'] || {{}};

// Store original onload and refresh if they exist
const original_onload = frappe.listview_settings['{doctype}'].onload;
const original_refresh = frappe.listview_settings['{doctype}'].refresh;

frappe.listview_settings['{doctype}'].onload = function(listview) {{
    // Call original onload if exists
    if (original_onload) {{
        original_onload.call(this, listview);
    }}
    
    X7Z9_Banner_{clean_doctype}_Q4K2_ListView();
    Y3M8_Footer_{clean_doctype}_P5N1_ListView();
}};

frappe.listview_settings['{doctype}'].refresh = function(listview) {{
    // Call original refresh if exists
    if (original_refresh) {{
        original_refresh.call(this, listview);
    }}
    
    if (!$('.custom-smart-banner').length) {{
        X7Z9_Banner_{clean_doctype}_Q4K2_ListView();
    }}
    if (!$('.custom-list-footer').length) {{
        Y3M8_Footer_{clean_doctype}_P5N1_ListView();
    }}
}};

function X7Z9_Banner_{clean_doctype}_Q4K2_ListView() {{
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
                margin: 15px auto 20px auto;
                max-width: 97%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <i class="fa {config.get('icon', 'fa-list')}" style="margin-right: 12px; font-size: 24px;"></i>
                        {config.get('title', '# ')} ${{doctypeName}}
                    </div>
                    <div class="banner-actions">
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
                .custom-banner-wrapper {{
                    display: flex;
                    justify-content: center;
                }}
                
                /* Mobile responsive styles */
                @media (max-width: 768px) {{
                    .custom-smart-banner {{
                        font-size: 16px !important;
                        padding: 15px 16px !important;
                    }}
                    .custom-smart-banner .fa {{
                        font-size: 20px !important;
                    }}
                    .banner-actions .badge {{
                        font-size: 12px !important;
                        padding: 4px 8px !important;
                    }}
                }}
            </style>
        `;
        
        const mainSection = cur_list.$page.find('.layout-main-section');
        if (mainSection.length) {{
            mainSection.prepend(banner);
        }}
    }});
}}

function Y3M8_Footer_{clean_doctype}_P5N1_ListView() {{
    frappe.after_ajax(() => {{
        $('.custom-list-footer').remove();
        
        const footer = `
            <div class="custom-list-footer" style="
                background: linear-gradient(90deg, #f8f9fa, #e9ecef);
                border-top: 2px solid #2d6eaf;
                padding: 20px 24px;
                margin: 20px auto 100px auto;
                max-width: 97%;
                border-radius: 8px;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
            ">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="{config.get('logo_path', '/files/logo.png')}" alt="Company Logo" style="height: 40px; width: auto;">
                        <div>
                            <div style="font-size: 14px; color: #666; font-weight: 500;">
                                BY : {config.get('company_name', 'Your Company')}
                            </div>
                            <div style="font-size: 12px; color: #999;">
                                © ${{new Date().getFullYear()}} All rights reserved
                            </div>
                        </div>
                    </div>
                    <div class="footer-actions" style="display: flex; gap: 15px; align-items: center;">
                        <button class="btn btn-sm btn-default" onclick="frappe.set_route('List', '{doctype}', {{}})">
                            <i class="fa fa-refresh"></i> Refresh
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="frappe.new_doc('{doctype}')">
                            <i class="fa fa-plus"></i> New {doctype}
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                /* Mobile responsive styles */
                @media (max-width: 768px) {{
                    .custom-list-footer {{
                        padding: 15px 16px !important;
                    }}
                    .custom-list-footer img {{
                        height: 32px !important;
                    }}
                    .custom-list-footer .footer-actions {{
                        display: none !important;
                    }}
                }}
            </style>
        `;
        
        const mainSection = cur_list.$page.find('.layout-main-section');
        if (mainSection.length) {{
            mainSection.append(footer);
        }}
    }});
}}"""


def generate_form_view_script(doctype, config):
    """Generate Form View Client Script code"""
    clean_doctype = doctype.replace(' ', '').replace('-', '')
    
    return f"""// Auto-generated Banner & Footer for {doctype} Form View
frappe.ui.form.on('{doctype}', {{
    onload: function(frm) {{
        A9B3_{clean_doctype}_Banner_K6T8_Form(frm);
        C5D2_{clean_doctype}_Footer_L8W4_Form(frm);
    }},
    refresh: function(frm) {{
        A9B3_{clean_doctype}_Banner_K6T8_Form(frm);
        C5D2_{clean_doctype}_Footer_L8W4_Form(frm);
    }}
}});

function A9B3_{clean_doctype}_Banner_K6T8_Form(frm) {{
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
            margin: 15px auto 20px auto;
            max-width: 97%;
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
                <div class="form-banner-actions" style="display: flex; align-items: center; gap: 10px;">
                    ${{statusBadge}}
                    ${{!isNew ? `<button class="btn btn-light btn-sm print-btn" onclick="cur_frm.print_doc()"><i class="fa fa-print"></i> Print</button>` : ''}}
                </div>
            </div>
        </div>
        
        <style>
            @keyframes slideIn {{
                from {{ opacity: 0; transform: translateY(-20px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}
            
            /* Mobile responsive styles */
            @media (max-width: 768px) {{
                .custom-form-banner {{
                    font-size: 16px !important;
                    padding: 15px 16px !important;
                }}
                .custom-form-banner .fa {{
                    font-size: 20px !important;
                }}
                .custom-form-banner > div > div:first-child > div:first-child {{
                    font-size: 18px !important;
                }}
                .custom-form-banner > div > div:first-child > div:last-child {{
                    font-size: 12px !important;
                }}
                .form-banner-actions .print-btn {{
                    display: none !important;
                }}
                .form-banner-actions .badge {{
                    font-size: 12px !important;
                    padding: 4px 8px !important;
                }}
            }}
        </style>
    `;
    
    $(frm.wrapper).find('.layout-main-section').prepend(banner);
}}

function C5D2_{clean_doctype}_Footer_L8W4_Form(frm) {{
    $('.custom-form-footer').remove();
    
    const isNew = frm.is_new();
    
    const footer = `
        <div class="custom-form-footer" style="
            background: linear-gradient(90deg, #f8f9fa, #e9ecef);
            border-top: 2px solid #2d6eaf;
            padding: 24px;
            margin: 20px auto 100px auto;
            max-width: 97%;
            border-radius: 8px;
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
                            © ${{new Date().getFullYear()}} ✉️ hello@capital-project.io
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                    ${{!isNew ? `
                        <div class="modified-info" style="font-size: 12px; color: #666; text-align: right;">
                            <div>Last Modified: ${{frappe.datetime.prettyDate(frm.doc.modified)}}</div>
                            <div>By: ${{frm.doc.modified_by}}</div>
                        </div>
                    ` : ''}}
                    <div class="form-footer-actions" style="display: flex; gap: 10px;">
                        <button class="btn btn-sm btn-default back-to-list-btn" onclick="frappe.set_route('List', '{doctype}')">
                            <i class="fa fa-list"></i> Back to List
                        </button>
                        ${{!isNew ? `<button class="btn btn-sm btn-info new-doc-btn" onclick="frappe.new_doc('{doctype}')"><i class="fa fa-plus"></i> New {doctype}</button>` : ''}}
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            /* Mobile responsive styles */
            @media (max-width: 768px) {{
                .custom-form-footer {{
                    padding: 15px 16px !important;
                }}
                .custom-form-footer > div {{
                    grid-template-columns: 1fr !important;
                }}
                .custom-form-footer img {{
                    height: 35px !important;
                }}
                .custom-form-footer .modified-info {{
                    display: none !important;
                }}
                .form-footer-actions .new-doc-btn {{
                    display: none !important;
                }}
                .custom-form-footer > div > div:last-child {{
                    align-items: flex-start !important;
                    margin-top: 10px;
                }}
            }}
        </style>
    `;
    
    $(frm.wrapper).find('.layout-main-section').append(footer);
}}"""
