// Copyright (c) 2016, Frappe Technologies and contributors
// For license information, please see license.txt
// Enhanced Client Script with checking functionality



function updateDoctypeList(dialog, module) {
    dialog.fields_dict.doctypes_html.$wrapper.html(
        '<div class="text-muted"><i class="fa fa-spinner fa-spin"></i> Loading doctypes...</div>'
    );
    
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'DocType',
            fields: ['name', 'module', 'custom'],
            filters: {
                module: module,
                istable: 0
            },
            order_by: 'name',
            limit: 500
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                // Store doctypes in dialog for later use
                dialog.doctypes = r.message;
                
                // Check which ones already have banner
                let doctype_names = r.message.map(dt => dt.name);
                checkExistingBannersForDoctypes(doctype_names, dialog, function(existing_data) {
                    renderDoctypeCheckboxes(dialog, r.message, existing_data);
                });
            } else {
                dialog.fields_dict.doctypes_html.$wrapper.html(
                    '<div class="text-muted">No doctypes found for this module.</div>'
                );
            }
        }
    });
}

function checkExistingBannersForDoctypes(doctypes, dialog, callback) {
    frappe.call({
        method: 'frappe.utils.doctype_files.check_existing_banner_code',
        args: {
            doctypes: doctypes
        },
        callback: function(r) {
            if (r.message) {
                callback(r.message);
            } else {
                callback({});
            }
        },
        error: function() {
            // If method doesn't exist, continue without checking
            callback({});
        }
    });
}

function renderDoctypeCheckboxes(dialog, doctypes, existing_data = {}) {
    let html = '<div class="doctype-checkbox-container" style="max-height: 300px; overflow-y: auto; border: 1px solid #d1d8dd; border-radius: 4px; padding: 10px;">';
    
    let stats = {
        total: 0,
        with_banner: 0,
        without_banner: 0
    };
    
    doctypes.forEach(function(dt) {
        if (['DocType', 'Module Def', 'Print Format', 'Page', 'Report'].includes(dt.name)) {
            return;
        }
        
        stats.total++;
        let existing = existing_data[dt.name] || {};
        let has_banner = existing.has_any || false;
        
        if (has_banner) {
            stats.with_banner++;
        } else {
            stats.without_banner++;
        }
        
        let status_icon = '';
        let status_text = '';
        
        if (existing.has_list_banner && existing.has_form_banner) {
            status_icon = '<i class="fa fa-check-circle text-success" title="Has both list and form banners"></i>';
            status_text = ' <small class="text-success">(Complete)</small>';
        } else if (existing.has_list_banner || existing.has_form_banner) {
            status_icon = '<i class="fa fa-exclamation-circle text-warning" title="Has partial banner"></i>';
            status_text = ' <small class="text-warning">(Partial)</small>';
        } else {
            status_icon = '<i class="fa fa-circle-o text-muted" title="No banner"></i>';
            status_text = '';
        }
        
        html += `
            <div class="checkbox doctype-item" style="margin: 5px 0;" data-has-banner="${has_banner}">
                <label style="font-weight: normal; margin-bottom: 0; cursor: pointer; display: flex; align-items: center;">
                    <input type="checkbox" class="doctype-check" data-doctype="${dt.name}" style="margin-right: 8px;">
                    <span style="flex: 1;">${dt.name}</span>
                    ${status_icon}
                    ${status_text}
                    ${dt.custom ? '<span class="text-warning" style="font-size: 11px; margin-left: 5px;">(Custom)</span>' : ''}
                </label>
            </div>
        `;
    });
    
    html += '</div>';
    html += `
        <div class="stats-container" style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
            <div class="row">
                <div class="col-xs-4 text-center">
                    <div style="font-size: 24px; font-weight: bold;">${stats.total}</div>
                    <div class="text-muted">Total</div>
                </div>
                <div class="col-xs-4 text-center">
                    <div style="font-size: 24px; font-weight: bold; color: #28a745;">${stats.with_banner}</div>
                    <div class="text-muted">With Banner</div>
                </div>
                <div class="col-xs-4 text-center">
                    <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${stats.without_banner}</div>
                    <div class="text-muted">Without Banner</div>
                </div>
            </div>
        </div>
        <div class="selected-count text-muted" style="margin-top: 10px; font-weight: bold;">0 doctypes selected</div>
    `;
    
    dialog.fields_dict.doctypes_html.$wrapper.html(html);
    
    // Store existing data for later use
    dialog.existing_banner_data = existing_data;
    
    // Add change event
    dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-check').on('change', function() {
        updateSelectedCount(dialog);
    });
}

function filterDoctypes(dialog) {
    let filter = (dialog.get_value('doctype_filter') || '').toLowerCase();
    let hide_existing = dialog.get_value('hide_existing');
    let items = dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-item');
    
    items.each(function() {
        let $item = $(this);
        let doctypeName = $item.find('.doctype-check').data('doctype').toLowerCase();
        let has_banner = $item.data('has-banner') === true || $item.data('has-banner') === 'true';
        
        let show = true;
        
        // Text filter
        if (filter && !doctypeName.includes(filter)) {
            show = false;
        }
        
        // Hide existing filter
        if (hide_existing && has_banner) {
            show = false;
        }
        
        if (show) {
            $item.show();
        } else {
            $item.hide();
        }
    });
    
    updateSelectedCount(dialog);
}

function checkExistingBanners(dialog) {
    let selected = [];
    dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-check:checked').each(function() {
        selected.push($(this).data('doctype'));
    });
    
    if (selected.length === 0) {
        frappe.msgprint('Please select doctypes to check');
        return;
    }
    
    frappe.call({
        method: 'frappe.utils.doctype_files.check_existing_banner_code',
        args: {
            doctypes: selected
        },
        callback: function(r) {
            if (r.message) {
                let report = '<h5>Banner Status Report</h5><ul>';
                
                selected.forEach(doctype => {
                    let status = r.message[doctype];
                    if (status) {
                        let icon = status.has_any ? '✅' : '❌';
                        report += `<li><b>${doctype}</b>: ${icon} `;
                        
                        if (status.has_list_banner && status.has_form_banner) {
                            report += 'Has both list and form banners';
                        } else if (status.has_list_banner) {
                            report += 'Has list banner only';
                        } else if (status.has_form_banner) {
                            report += 'Has form banner only';
                        } else {
                            report += 'No banner code found';
                        }
                        
                        report += '</li>';
                    }
                });
                
                report += '</ul>';
                
                frappe.msgprint({
                    title: 'Existing Banner Check',
                    message: report,
                    wide: true
                });
            }
        }
    });
}

function createBannerFooterScripts(values, dialog) {
    let selectedDoctypes = [];
    dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-check:checked').each(function() {
        selectedDoctypes.push($(this).data('doctype'));
    });
    
    if (selectedDoctypes.length === 0) {
        frappe.msgprint({
            title: 'No Selection',
            message: 'Please select at least one doctype',
            indicator: 'orange'
        });
        return;
    }
    
    // Check which ones already have banners
    let existing_banners = [];
    let new_banners = [];
    
    selectedDoctypes.forEach(doctype => {
        if (dialog.existing_banner_data && dialog.existing_banner_data[doctype] && dialog.existing_banner_data[doctype].has_any) {
            existing_banners.push(doctype);
        } else {
            new_banners.push(doctype);
        }
    });
    
    let confirm_message = `<h4>Create JavaScript Files</h4>`;
    
    if (new_banners.length > 0) {
        confirm_message += `<p>Will create new banner for <b>${new_banners.length}</b> doctypes.</p>`;
    }
    
    if (existing_banners.length > 0 && !values.force_overwrite) {
        confirm_message += `<p class="text-warning">⚠️ Will skip <b>${existing_banners.length}</b> doctypes that already have banners:</p>`;
        confirm_message += `<ul style="max-height: 100px; overflow-y: auto;">`;
        existing_banners.forEach(dt => {
            confirm_message += `<li>${dt}</li>`;
        });
        confirm_message += `</ul>`;
        confirm_message += `<p class="text-muted">Enable "Force Overwrite" to update these.</p>`;
    } else if (existing_banners.length > 0 && values.force_overwrite) {
        confirm_message += `<p class="text-danger">⚠️ Will OVERWRITE <b>${existing_banners.length}</b> doctypes that already have banners!</p>`;
    }
    
    confirm_message += `<p><b>Continue?</b></p>`;
    
    // Get gradient colors
    const gradients = {
        'Blue': 'linear-gradient(90deg, #2d6eaf, #51a8f9)',
        'Purple': 'linear-gradient(90deg, #667eea, #764ba2)',
        'Green': 'linear-gradient(90deg, #11998e, #38ef7d)',
        'Orange': 'linear-gradient(90deg, #f2994a, #f2c94c)',
        'Dark': 'linear-gradient(90deg, #232526, #414345)'
    };
    
    const config = {
        title: values.banner_title,
        icon: values.banner_icon,
        gradient: gradients[values.banner_gradient] || gradients['Blue'],
        logo_path: values.logo_path,
        company_name: values.company_name
    };
    
    frappe.confirm(
        confirm_message,
        () => {
            frappe.call({
                method: 'frappe.utils.doctype_files.create_doctype_js_files',
                args: {
                    doctypes: selectedDoctypes,
                    banner_config: config,
                    force_overwrite: values.force_overwrite || false
                },
                freeze: true,
                freeze_message: `Creating JavaScript files for ${selectedDoctypes.length} doctypes...`,
                callback: function(r) {
                    if (r.message) {
                        dialog.hide();
                        
                        // Process results
                        let created = 0;
                        let skipped = 0;
                        let errors = 0;
                        
                        let details = '<h5>Results:</h5><ul>';
                        
                        r.message.forEach(item => {
                            if (item.status === 'success') {
                                created++;
                                details += `<li>✅ <b>${item.doctype}</b>: Created/Updated`;
                                if (item.updated_list && item.updated_form) {
                                    details += ' (both views)';
                                } else if (item.updated_list) {
                                    details += ' (list view only)';
                                } else if (item.updated_form) {
                                    details += ' (form view only)';
                                }
                                details += '</li>';
                            } else if (item.status === 'skipped') {
                                skipped++;
                                details += `<li>⏭️ <b>${item.doctype}</b>: Skipped (already has banner)</li>`;
                            } else {
                                errors++;
                                details += `<li>❌ <b>${item.doctype}</b>: Error - ${item.error}</li>`;
                            }
                        });
                        
                        details += '</ul>';
                        
                        let summary = `Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`;
                        
                        frappe.msgprint({
                            title: 'JavaScript Files Created',
                            message: `<p><b>Summary:</b> ${summary}</p>${details}`,
                            indicator: errors > 0 ? 'orange' : 'green',
                            wide: true
                        });
                        
                        if (created > 0) {
                            setTimeout(() => {
                                frappe.confirm(
                                    'Files created successfully. Run "bench build" and reload to see changes. Reload now?',
                                    () => {
                                        window.location.reload();
                                    }
                                );
                            }, 2000);
                        }
                    }
                }
            });
        }
    );
}

function toggleAllDoctypes(dialog) {
    let selectAll = dialog.get_value('select_all');
    let visibleCheckboxes = dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-item:visible .doctype-check');
    visibleCheckboxes.prop('checked', selectAll);
    updateSelectedCount(dialog);
}

function updateSelectedCount(dialog) {
    let total = dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-check').length;
    let checked = dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-check:checked').length;
    let visible = dialog.fields_dict.doctypes_html.$wrapper.find('.doctype-item:visible').length;
    
    let countText = `${checked} doctypes selected`;
    if (visible < total) {
        countText += ` (${visible} visible out of ${total} total)`;
    }
    
    dialog.fields_dict.doctypes_html.$wrapper.find('.selected-count').text(countText);
}



frappe.ui.form.on("Client Script", {
	setup(frm) {
		frm.get_field("sample").html(SAMPLE_HTML);
	},
	refresh(frm) {
		if (frm.doc.dt && frm.doc.script) {
			frm.add_custom_button(__("Go to {0}", [frm.doc.dt]), () =>
				frappe.set_route("List", frm.doc.dt, "List")
			);
		}

		if (frm.doc.view == "Form") {
			frm.add_custom_button(__("Add script for Child Table"), () => {
				frappe.model.with_doctype(frm.doc.dt, () => {
					const child_tables = frappe.meta
						.get_docfields(frm.doc.dt, null, {
							fieldtype: "Table",
						})
						.map((df) => df.options);

					const d = new frappe.ui.Dialog({
						title: __("Select Child Table"),
						fields: [
							{
								label: __("Select Child Table"),
								fieldtype: "Link",
								fieldname: "cdt",
								options: "DocType",
								get_query: () => {
									return {
										filters: {
											istable: 1,
											name: ["in", child_tables],
										},
									};
								},
							},
						],
						primary_action: ({ cdt }) => {
							cdt = d.get_field("cdt").value;
							frm.events.add_script_for_doctype(frm, cdt);
							d.hide();
						},
					});

					d.show();
				});
			});

			if (!frm.is_new()) {
				frm.add_custom_button(__("Compare Versions"), () => {
					new frappe.ui.DiffView("Client Script", "script", frm.doc.name);
				});
			}
		}

		frm.set_query("dt", {
			filters: {
				istable: 0,
			},
		});
	},

	dt(frm) {
		frm.toggle_display("view", !frappe.boot.single_types.includes(frm.doc.dt));

		if (!frm.doc.script) {
			frm.events.add_script_for_doctype(frm, frm.doc.dt);
		}

		if (frm.doc.script && !frm.doc.script.includes(frm.doc.dt)) {
			frm.doc.script = "";
			frm.events.add_script_for_doctype(frm, frm.doc.dt);
		}
	},

	view(frm) {
		let has_form_boilerplate = frm.doc.script.includes("frappe.ui.form.on");
		if (frm.doc.view === "List" && has_form_boilerplate) {
			frm.set_value("script", "");
		}
		if (frm.doc.view === "Form" && !has_form_boilerplate) {
			frm.trigger("dt");
		}
	},

	add_script_for_doctype(frm, doctype) {
		if (!doctype) return;
		let boilerplate = `
frappe.ui.form.on('${doctype}', {
	refresh(frm) {
		// your code here
	}
})
		`.trim();
		let script = frm.doc.script || "";
		if (script) {
			script += "\n\n";
		}
		frm.set_value("script", script + boilerplate);
	},
});

const SAMPLE_HTML = `<h3>Client Script Help</h3>
<p>Client Scripts are executed only on the client-side (i.e. in Forms). Here are some examples to get you started</p>
<pre><code>

// fetch local_tax_no on selection of customer
// cur_frm.add_fetch(link_field,  source_fieldname,  target_fieldname);
cur_frm.add_fetch("customer",  "local_tax_no',  'local_tax_no');

// additional validation on dates
frappe.ui.form.on('Task',  'validate',  function(frm) {
    if (frm.doc.from_date &lt; get_today()) {
        msgprint('You can not select past date in From Date');
        validated = false;
    }
});

// make a field read-only after saving
frappe.ui.form.on('Task',  {
    refresh: function(frm) {
        // use the __islocal value of doc,  to check if the doc is saved or not
        frm.set_df_property('myfield',  'read_only',  frm.doc.__islocal ? 0 : 1);
    }
});

// additional permission check
frappe.ui.form.on('Task',  {
    validate: function(frm) {
        if(user=='user1@example.com' &amp;&amp; frm.doc.purpose!='Material Receipt') {
            msgprint('You are only allowed Material Receipt');
            validated = false;
        }
    }
});

// calculate sales incentive
frappe.ui.form.on('Sales Invoice',  {
    validate: function(frm) {
        // calculate incentives for each person on the deal
        total_incentive = 0
        $.each(frm.doc.sales_team,  function(i,  d) {
            // calculate incentive
            var incentive_percent = 2;
            if(frm.doc.base_grand_total &gt; 400) incentive_percent = 4;
            // actual incentive
            d.incentives = flt(frm.doc.base_grand_total) * incentive_percent / 100;
            total_incentive += flt(d.incentives)
        });
        frm.doc.total_incentive = total_incentive;
    }
})

</code></pre>`;



frappe.ui.form.on('Client Script', {
    before_save(frm) {
        if (frm.is_new() && !frm.doc.version) {
            frm.set_value('version', 'Ver 0.0');
        }
    },

    refresh(frm) {
        if (!frm.is_new()) {
            frm.set_df_property('script_code_name', 'read_only', 1);
        }

        // 🎨 تنسيق الزر البرتقالي نفسه وليس الخلفية
        if (frm.fields_dict.new_version) {
            const $button = frm.fields_dict.new_version.$wrapper.find('button');
            $button.css({
                'background-color': '#f97316',   // Orange-500
                'color': '#ffffff',
                'border': 'none',
                'padding': '10px 20px',
                'border-radius': '6px',
                'font-weight': '600',
                'cursor': 'pointer',
                'box-shadow': '0 4px 8px rgba(0, 0, 0, 0.1)',
                'transition': 'all 0.3s ease-in-out'
            }).hover(
                function () {
                    $(this).css('background-color', '#ea580c'); // Darker orange on hover
                },
                function () {
                    $(this).css('background-color', '#f97316'); // Original color
                }
            );
        }
    },

    new_version: async function (frm) {
        const current_version = frm.doc.version || "Ver 0.0";
        const match = current_version.match(/Ver\s+(\d+)\.(\d+)/);

        let new_version = "Ver 0.1";
        if (match) {
            let major = parseInt(match[1]);
            let minor = parseInt(match[2]);
            minor += 1;
            new_version = `Ver ${major}.${minor}`;
        }

        await frappe.call({
            method: 'frappe.client.set_value',
            args: {
                doctype: 'Client Script',
                name: frm.doc.name,
                fieldname: { enabled: 0 }
            }
        });

        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Client Script',
                name: frm.doc.name
            },
            callback: function (r) {
                if (r.message) {
                    let new_doc = frappe.model.copy_doc(r.message);

                    const now = frappe.datetime.now_datetime();
                    const formatted_now = frappe.datetime.str_to_user(now).split(':').slice(0, 2).join(':');

                    new_doc.version = new_version;
                    new_doc.enabled = 1;

                    frappe.call({
                        method: 'frappe.client.insert',
                        args: { doc: new_doc },
                        callback: function (res) {
                            if (res.message) {
                                frappe.msgprint(__('✅ New version created successfully'));
                                frappe.set_route('Form', 'Client Script', res.message.name);
                            }
                        }
                    });
                }
            }
        });
    }
});


frappe.ui.form.on('Client Script', {
    refresh: function(frm) {
        // Initialize analytics when form loads
        if (frm.doc.script) {
            setTimeout(() => {
                updateScriptAnalytics(frm);
            }, 100);
        }
    },
    
    script: function(frm) {
        // Update analytics when script changes
        updateScriptAnalytics(frm);
    },
    
    onload: function(frm) {
        // Also update on load
        if (frm.doc.script) {
            updateScriptAnalytics(frm);
        }
    }
});

function updateScriptAnalytics(frm) {
    const script = frm.doc.script || '';
    
    if (!script) {
        // Clear analytics if no script
        frm.fields_dict.client_script_analytic.$wrapper.html('<p style="padding: 20px; text-align: center; color: #6c757d;">No script to analyze</p>');
        return;
    }
    
    // Check if this is the analytics script itself
    if (script.includes('function updateScriptAnalytics') && script.includes('function analyzeClientScript')) {
        frm.fields_dict.client_script_analytic.$wrapper.html(`
            <div style="padding: 40px; text-align: center; background: #f8f9fa; border-radius: 8px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
                <h3 style="color: #2c3e50; margin-bottom: 10px;">Self-Analysis Detected</h3>
                <p style="color: #6c757d; max-width: 500px; margin: 0 auto;">
                    This appears to be the analytics script itself. For best results, analyze other Client Scripts 
                    that contain your business logic rather than the analytics tool.
                </p>
                <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 6px; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto;">
                    <strong style="color: #1976d2;">Try analyzing scripts that:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #495057;">
                        <li>Handle form events (refresh, validate, etc.)</li>
                        <li>Make API calls to fetch or save data</li>
                        <li>Implement custom business logic</li>
                        <li>Validate user inputs</li>
                    </ul>
                </div>
            </div>
        `);
        return;
    }
    
    const analytics = analyzeClientScript(script);
    
    // Generate HTML for analytics display
    const analyticsHTML = generateAnalyticsHTML(analytics);
    
    // Update the HTML field directly using the wrapper
    if (frm.fields_dict.client_script_analytic) {
        frm.fields_dict.client_script_analytic.$wrapper.html(analyticsHTML);
    }
    
    // Alternative method - set value and refresh
    frm.set_value('client_script_analytic', analyticsHTML);
    frm.refresh_field('client_script_analytic');
}

function extractFunctions(script, lines) {
    const functions = [];
    
    // Pattern to match various function declarations
    const patterns = [
        // Named functions: function name(params)
        { regex: /function\s+(\w+)\s*\([^)]*\)/g, type: 'named' },
        // Anonymous functions assigned to variables: const name = function()
        { regex: /(?:const|let|var)\s+(\w+)\s*=\s*function\s*\([^)]*\)/g, type: 'variable' },
        // Arrow functions assigned to variables: const name = () =>
        { regex: /(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g, type: 'arrow' },
        // Object method: name: function()
        { regex: /(\w+)\s*:\s*function\s*\([^)]*\)/g, type: 'method' },
        // Object method arrow: name: () =>
        { regex: /(\w+)\s*:\s*\([^)]*\)\s*=>/g, type: 'arrow-method' },
        // Object method shorthand: name() {
        { regex: /(\w+)\s*\([^)]*\)\s*{/g, type: 'shorthand' }
    ];
    
    patterns.forEach(({ regex, type }) => {
        let match;
        while ((match = regex.exec(script)) !== null) {
            const functionName = match[1];
            const startIndex = match.index;
            
            // Find which line this function starts on
            let charCount = 0;
            let startLine = 1;
            for (let i = 0; i < lines.length; i++) {
                if (charCount + lines[i].length >= startIndex) {
                    startLine = i + 1;
                    break;
                }
                charCount += lines[i].length + 1; // +1 for newline
            }
            
            // Find the end of the function
            const endLine = findFunctionEnd(script, startIndex, lines);
            
            // Extract function body for analysis
            const functionBody = extractFunctionBody(script, startIndex);
            
            functions.push({
                name: functionName,
                type: type,
                startLine: startLine,
                endLine: endLine,
                complexity: calculateFunctionComplexity(functionBody),
                hasDocumentation: checkFunctionDocumentation(script, startIndex),
                parameters: extractFunctionParameters(match[0])
            });
        }
    });
    
    // Sort functions by start line
    return functions.sort((a, b) => a.startLine - b.startLine);
}

function extractFunctionBody(script, startIndex) {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let foundFirstBrace = false;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < script.length; i++) {
        const char = script[i];
        const prevChar = i > 0 ? script[i-1] : '';
        
        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        if (!inString) {
            if (char === '{') {
                foundFirstBrace = true;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (foundFirstBrace && braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }
    
    return script.substring(startIndex, endIndex);
}

function extractFunctionParameters(functionDeclaration) {
    const paramMatch = functionDeclaration.match(/\(([^)]*)\)/);
    if (paramMatch && paramMatch[1]) {
        return paramMatch[1].split(',').map(p => p.trim()).filter(p => p);
    }
    return [];
}

function checkFunctionDocumentation(script, startIndex) {
    // Check if there's a JSDoc comment before the function
    const beforeFunction = script.substring(Math.max(0, startIndex - 500), startIndex);
    return /\/\*\*[\s\S]*?\*\/\s*$/.test(beforeFunction);
}

function findFunctionEnd(script, startIndex, lines) {
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    let foundFirstBrace = false;
    
    for (let i = startIndex; i < script.length; i++) {
        const char = script[i];
        const prevChar = i > 0 ? script[i-1] : '';
        
        // Handle strings
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        if (!inString) {
            if (char === '{') {
                foundFirstBrace = true;
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (foundFirstBrace && braceCount === 0) {
                    // Found the closing brace
                    let charCount = 0;
                    for (let j = 0; j < lines.length; j++) {
                        if (charCount + lines[j].length >= i) {
                            return j + 1;
                        }
                        charCount += lines[j].length + 1;
                    }
                }
            }
        }
    }
    
    // If we couldn't find the end, return the last line
    return lines.length;
}

function calculateFunctionComplexity(functionBody) {
    const decisionPoints = functionBody.match(/\b(if|else if|switch|for|while|do|catch|\?|&&|\|\|)\b/g);
    return (decisionPoints ? decisionPoints.length : 0) + 1;
}

function analyzeVariables(script) {
    const variables = {
        declared: [],
        fields: [],
        globals: []
    };
    
    // Extract declared variables
    const varPatterns = [
        { regex: /(?:const|let|var)\s+(\w+)/g, scope: 'local' }
    ];
    
    varPatterns.forEach(({ regex, scope }) => {
        let match;
        while ((match = regex.exec(script)) !== null) {
            variables.declared.push({
                name: match[1],
                type: match[0].includes('const') ? 'const' : match[0].includes('let') ? 'let' : 'var',
                scope: scope
            });
        }
    });
    
    // Extract field accesses
    const fieldPatterns = [
        /frm\.set_value\(['"](\w+)['"]/g,
        /frm\.get_value\(['"](\w+)['"]/g,
        /frm\.doc\.(\w+)/g,
        /frm\.fields_dict\[['"](\w+)['"]\]/g,
        /frm\.fields_dict\.(\w+)/g
    ];
    
    const fieldSet = new Set();
    fieldPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(script)) !== null) {
            fieldSet.add(match[1]);
        }
    });
    
    variables.fields = Array.from(fieldSet).map(field => ({
        name: field,
        readCount: (script.match(new RegExp(`frm\\.doc\\.${field}|frm\\.get_value\\(['"]${field}['"]\\)`, 'g')) || []).length,
        writeCount: (script.match(new RegExp(`frm\\.set_value\\(['"]${field}['"]`, 'g')) || []).length
    }));
    
    // Check for potential globals
    const globalPatterns = [
        /window\.(\w+)\s*=/g,
        /global\.(\w+)\s*=/g
    ];
    
    globalPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(script)) !== null) {
            variables.globals.push(match[1]);
        }
    });
    
    // Check for undeclared variables (potential globals)
    const allIdentifiers = script.match(/\b[a-zA-Z_]\w*\b/g) || [];
    const declaredNames = new Set(variables.declared.map(v => v.name));
    const knownGlobals = new Set(['frm', 'frappe', 'console', 'window', 'document', 'setTimeout', 'setInterval']);
    
    allIdentifiers.forEach(identifier => {
        if (!declaredNames.has(identifier) && 
            !knownGlobals.has(identifier) && 
            /^[a-z]/.test(identifier) && // starts with lowercase
            script.includes(`${identifier} =`)) {
            variables.globals.push(identifier);
        }
    });
    
    return variables;
}

function analyzeSecurityIssues(script) {
    const security = {
        issues: [],
        score: 100
    };
    
    // Security patterns to check
    const securityPatterns = [
        {
            pattern: /eval\s*\(/g,
            severity: 'high',
            message: 'Use of eval() is dangerous and can lead to code injection attacks'
        },
        {
            pattern: /innerHTML\s*=/g,
            severity: 'medium',
            message: 'innerHTML can lead to XSS attacks. Use textContent or Frappe\'s sanitization methods'
        },
        {
            pattern: /document\.write/g,
            severity: 'medium',
            message: 'document.write can be dangerous. Use Frappe\'s DOM manipulation methods'
        },
        {
            pattern: /\$\s*\(\s*['"`]<[^>]+>[^<]*<\/[^>]+>['"`]\s*\)/g,
            severity: 'low',
            message: 'Creating HTML with jQuery can be risky. Ensure proper sanitization'
        },
        {
            pattern: /\.html\s*\([^)]*\+[^)]*\)/g,
            severity: 'medium',
            message: 'Dynamic HTML content should be sanitized to prevent XSS'
        },
        {
            pattern: /setTimeout\s*\(\s*['"`]/g,
            severity: 'high',
            message: 'setTimeout with string argument can lead to code injection'
        },
        {
            pattern: /setInterval\s*\(\s*['"`]/g,
            severity: 'high',
            message: 'setInterval with string argument can lead to code injection'
        },
        {
            pattern: /new\s+Function\s*\(/g,
            severity: 'high',
            message: 'Function constructor can be used for code injection'
        }
    ];
    
    securityPatterns.forEach(({ pattern, severity, message }) => {
        const matches = script.match(pattern);
        if (matches) {
            security.issues.push({
                type: severity,
                message: message,
                count: matches.length
            });
            
            // Deduct score based on severity
            const deduction = severity === 'high' ? 20 : severity === 'medium' ? 10 : 5;
            security.score -= deduction * matches.length;
        }
    });
    
    // Check for SQL injection risks
    if (/frappe\.db\.sql\s*\([^)]*\+[^)]*\)/.test(script)) {
        security.issues.push({
            type: 'high',
            message: 'Potential SQL injection risk. Use parameterized queries',
            count: 1
        });
        security.score -= 20;
    }
    
    // Check for proper input validation
    if (/frm\.doc\.\w+/.test(script) && !/validate|clean|sanitize|escape/.test(script)) {
        security.issues.push({
            type: 'low',
            message: 'Consider adding input validation for user data',
            count: 1
        });
        security.score -= 5;
    }
    
    security.score = Math.max(0, security.score);
    return security;
}

function analyzeDocumentation(script, functions) {
    const documentation = {
        score: 0,
        functionsDocs: 0,
        hasFileHeader: false,
        totalComments: 0,
        todoComments: []
    };
    
    // Check for file header documentation
    documentation.hasFileHeader = /^\/\*\*[\s\S]*?\*\//.test(script.trim());
    
    // Count documented functions
    documentation.functionsDocs = functions.filter(f => f.hasDocumentation).length;
    
    // Count all comments
    const comments = script.match(/\/\*[\s\S]*?\*\/|\/\/.*/g) || [];
    documentation.totalComments = comments.length;
    
    // Find TODO comments
    comments.forEach(comment => {
        if (/TODO|FIXME|HACK|XXX/i.test(comment)) {
            documentation.todoComments.push(comment.trim());
        }
    });
    
    // Calculate documentation score
    let score = 0;
    if (documentation.hasFileHeader) score += 20;
    if (functions.length > 0) {
        score += (documentation.functionsDocs / functions.length) * 50;
    }
    if (documentation.totalComments > 0) score += 20;
    if (documentation.todoComments.length === 0) score += 10;
    
    documentation.score = Math.round(score);
    
    return documentation;
}

function analyzePerformance(script, analytics) {
    const performance = {
        syncCalls: 0,
        domManipulations: 0,
        loops: 0,
        nestedLoops: 0,
        recommendations: []
    };
    
    // Check for synchronous calls
    performance.syncCalls = (script.match(/async\s*:\s*false/g) || []).length;
    
    // Check for DOM manipulations
    const domPatterns = [
        /document\.(getElementById|querySelector|getElementsBy)/g,
        /\$\([^)]+\)\.(append|prepend|html|text|val|attr|css|addClass|removeClass)/g,
        /\.innerHTML|\.outerHTML|\.textContent/g
    ];
    
    domPatterns.forEach(pattern => {
        const matches = script.match(pattern) || [];
        performance.domManipulations += matches.length;
    });
    
    // Count loops
    performance.loops = (script.match(/\b(for|while|do)\s*\(/g) || []).length;
    
    // Check for nested loops (simplified)
    const loopBlocks = script.match(/\b(for|while|do)\s*\([^{]*\{[^}]*\b(for|while|do)\s*\(/g) || [];
    performance.nestedLoops = loopBlocks.length;
    
    // Generate recommendations
    if (performance.syncCalls > 0) {
        performance.recommendations.push('Replace synchronous calls with async/await for better performance');
    }
    
    if (performance.domManipulations > 10) {
        performance.recommendations.push('Batch DOM manipulations to improve rendering performance');
    }
    
    if (performance.nestedLoops > 0) {
        performance.recommendations.push('Nested loops detected. Consider optimizing algorithm complexity');
    }
    
    if (analytics.frappe_apis.total > 5 && !script.includes('Promise.all')) {
        performance.recommendations.push('Multiple API calls detected. Consider using Promise.all for parallel execution');
    }
    
    return performance;
}

function detectCodeDuplication(script, lines) {
    const duplication = {
        duplicates: [],
        score: 100
    };
    
    // More intelligent duplication detection
    const minBlockSize = 5; // Increased minimum block size
    const minCharacters = 100; // Minimum characters for meaningful duplicate
    const blocks = [];
    const seenBlocks = new Map(); // Track already found duplicates
    
    // Patterns to ignore (common boilerplate)
    const ignorePatterns = [
        /^\s*}\s*$/,                    // Closing braces only
        /^\s*{\s*$/,                    // Opening braces only
        /^\s*\/\/.*$/,                  // Single line comments
        /^\s*\/\*.*\*\/\s*$/,          // Single line block comments
        /^\s*(let|const|var)\s+\w+\s*;?\s*$/, // Simple variable declarations
        /^\s*return\s*;?\s*$/,          // Simple returns
        /^\s*break\s*;?\s*$/,           // Break statements
        /^\s*continue\s*;?\s*$/,        // Continue statements
        /^\s*}\s*else\s*{\s*$/,         // else blocks
        /^\s*}\s*catch.*{\s*$/,         // catch blocks
    ];
    
    // Function to normalize code for comparison
    function normalizeCode(code) {
        return code
            .replace(/\s+/g, ' ')           // Normalize whitespace
            .replace(/;\s*$/g, '')          // Remove trailing semicolons
            .replace(/^\s+|\s+$/g, '')      // Trim
            .toLowerCase();                 // Case insensitive
    }
    
    // Function to check if block is trivial
    function isTrivialBlock(block) {
        const lines = block.split('\n');
        
        // Check if all lines match ignore patterns
        const nonTrivialLines = lines.filter(line => {
            return !ignorePatterns.some(pattern => pattern.test(line));
        });
        
        // If less than 50% of lines are non-trivial, consider it trivial
        return nonTrivialLines.length < lines.length * 0.5;
    }
    
    // Extract meaningful code blocks
    for (let i = 0; i <= lines.length - minBlockSize; i++) {
        const block = lines.slice(i, i + minBlockSize).join('\n');
        
        // Skip if block is too short or trivial
        if (block.length < minCharacters || isTrivialBlock(block)) {
            continue;
        }
        
        const normalizedBlock = normalizeCode(block);
        
        blocks.push({
            content: block,
            normalizedContent: normalizedBlock,
            startLine: i + 1,
            endLine: i + minBlockSize
        });
    }
    
    // Find duplicates with smarter matching
    for (let i = 0; i < blocks.length; i++) {
        for (let j = i + 1; j < blocks.length; j++) {
            // Skip if blocks overlap
            if (blocks[i].endLine >= blocks[j].startLine) {
                continue;
            }
            
            // Check for normalized content match
            if (blocks[i].normalizedContent === blocks[j].normalizedContent) {
                const key = `${blocks[i].normalizedContent}`;
                
                // Skip if we've already recorded this duplicate pattern
                if (seenBlocks.has(key)) {
                    continue;
                }
                
                seenBlocks.set(key, true);
                
                // Extract a meaningful preview
                const preview = blocks[i].content
                    .split('\n')
                    .filter(line => line.trim().length > 0)
                    .join(' ')
                    .substring(0, 80);
                
                duplication.duplicates.push({
                    lines1: `${blocks[i].startLine}-${blocks[i].endLine}`,
                    lines2: `${blocks[j].startLine}-${blocks[j].endLine}`,
                    content: preview + (preview.length >= 80 ? '...' : ''),
                    size: blocks[i].endLine - blocks[i].startLine + 1
                });
            }
        }
    }
    
    // Calculate duplication score more intelligently
    let totalDuplicatedLines = 0;
    duplication.duplicates.forEach(dup => {
        totalDuplicatedLines += dup.size * 2; // Count both occurrences
    });
    
    // Calculate percentage of duplicated lines
    const duplicatePercentage = (totalDuplicatedLines / lines.length) * 100;
    
    // Score calculation: 100% for no duplication, decreasing based on percentage
    if (duplicatePercentage === 0) {
        duplication.score = 100;
    } else if (duplicatePercentage < 5) {
        duplication.score = 95;
    } else if (duplicatePercentage < 10) {
        duplication.score = 85;
    } else if (duplicatePercentage < 20) {
        duplication.score = 70;
    } else if (duplicatePercentage < 30) {
        duplication.score = 50;
    } else {
        duplication.score = Math.max(0, 50 - Math.floor(duplicatePercentage - 30));
    }
    
    return duplication;
}

function analyzeClientScript(script) {
    const analytics = {
        general: {
            lines: 0,
            characters: 0,
            functions: 0,
            variables: 0,
            comments: 0
        },
        complexity: {
            cyclomatic: 0,
            nesting_depth: 0
        },
        frappe_apis: {
            total: 0,
            calls: []
        },
        patterns: {
            events: [],
            hooks: [],
            validations: false,
            server_calls: false
        },
        functions_list: [],
        variables_analysis: null,
        security: null,
        documentation: null,
        performance: null,
        duplication: null,
        potential_issues: [],
        suggestions: []
    };
    
    if (!script || script.trim() === '') return analytics;
    
    // Store script for reference
    analytics.script = script;
    
    // Basic metrics
    const lines = script.split('\n');
    analytics.general.lines = lines.length;
    analytics.general.characters = script.length;
    
    // Extract functions with line numbers
    analytics.functions_list = extractFunctions(script, lines);
    analytics.general.functions = analytics.functions_list.length;
    
    // Count variables
    const varMatches = script.match(/\b(var|let|const)\s+\w+/g);
    analytics.general.variables = varMatches ? varMatches.length : 0;
    
    // Count comments
    const singleLineComments = script.match(/\/\/.*/g);
    const multiLineComments = script.match(/\/\*[\s\S]*?\*\//g);
    analytics.general.comments = (singleLineComments ? singleLineComments.length : 0) + 
                                (multiLineComments ? multiLineComments.length : 0);
    
    // Analyze Frappe API usage
    const frappeAPIs = [
        { name: 'frappe.call', pattern: /frappe\.call/g },
        { name: 'frappe.db.get_value', pattern: /frappe\.db\.get_value/g },
        { name: 'frappe.db.set_value', pattern: /frappe\.db\.set_value/g },
        { name: 'frappe.msgprint', pattern: /frappe\.msgprint/g },
        { name: 'frappe.throw', pattern: /frappe\.throw/g },
        { name: 'frappe.confirm', pattern: /frappe\.confirm/g },
        { name: 'frappe.prompt', pattern: /frappe\.prompt/g },
        { name: 'frappe.show_alert', pattern: /frappe\.show_alert/g },
        { name: 'frappe.set_route', pattern: /frappe\.set_route/g },
        { name: 'frappe.model.set_value', pattern: /frappe\.model\.set_value/g },
        { name: 'frappe.model.get_value', pattern: /frappe\.model\.get_value/g },
        { name: 'frm.set_value', pattern: /frm\.set_value/g },
        { name: 'frm.save', pattern: /frm\.save/g },
        { name: 'frm.reload_doc', pattern: /frm\.reload_doc/g }
    ];
    
    frappeAPIs.forEach(api => {
        const matches = script.match(api.pattern);
        if (matches && matches.length > 0) {
            analytics.frappe_apis.total += matches.length;
            analytics.frappe_apis.calls.push({
                api: api.name,
                count: matches.length
            });
        }
    });
    
    // Detect patterns and events
    const eventPatterns = [
        { pattern: /refresh\s*:/g, name: 'refresh' },
        { pattern: /validate\s*:/g, name: 'validate' },
        { pattern: /before_save\s*:/g, name: 'before_save' },
        { pattern: /after_save\s*:/g, name: 'after_save' },
        { pattern: /before_submit\s*:/g, name: 'before_submit' },
        { pattern: /on_submit\s*:/g, name: 'on_submit' },
        { pattern: /before_cancel\s*:/g, name: 'before_cancel' },
        { pattern: /after_cancel\s*:/g, name: 'after_cancel' },
        { pattern: /onload\s*:/g, name: 'onload' },
        { pattern: /setup\s*:/g, name: 'setup' }
    ];
    
    eventPatterns.forEach(event => {
        if (event.pattern.test(script)) {
            analytics.patterns.events.push(event.name);
        }
    });
    
    // Field-specific events
    const fieldEventMatch = script.match(/[\w_]+\s*:\s*function\s*\(frm/g);
    if (fieldEventMatch) {
        analytics.patterns.events.push(`${fieldEventMatch.length} field events`);
    }
    
    // Check for validations
    analytics.patterns.validations = /frm\.validate|validate\s*:|\.validate\(|frappe\.validated/.test(script);
    
    // Check for server calls
    analytics.patterns.server_calls = /frappe\.call|frm\.call|\.call\(/.test(script);
    
    // Calculate basic cyclomatic complexity
    const decisionPoints = script.match(/\b(if|else if|switch|for|while|do|catch|\?|&&|\|\|)\b/g);
    analytics.complexity.cyclomatic = (decisionPoints ? decisionPoints.length : 0) + 1;
    
    // Calculate max nesting depth
    analytics.complexity.nesting_depth = calculateMaxNestingDepth(script);
    
    // Advanced analyses
    analytics.variables_analysis = analyzeVariables(script);
    analytics.security = analyzeSecurityIssues(script);
    analytics.documentation = analyzeDocumentation(script, analytics.functions_list);
    analytics.performance = analyzePerformance(script, analytics);
    analytics.duplication = detectCodeDuplication(script, lines);
    
    // Identify potential issues
    checkPotentialIssues(script, analytics);
    
    // Generate suggestions
    generateSuggestions(analytics, script);
    
    return analytics;
}

function calculateMaxNestingDepth(script) {
    let maxDepth = 0;
    let currentDepth = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < script.length; i++) {
        const char = script[i];
        const prevChar = i > 0 ? script[i-1] : '';
        
        // Handle strings to avoid counting braces inside strings
        if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        if (!inString) {
            if (char === '{') {
                currentDepth++;
                maxDepth = Math.max(maxDepth, currentDepth);
            } else if (char === '}') {
                currentDepth = Math.max(0, currentDepth - 1);
            }
        }
    }
    
    return maxDepth;
}

function checkPotentialIssues(script, analytics) {
    // Missing semicolons (improved check)
    const lines = script.split('\n');
    let missingSemicolons = 0;
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && 
            !trimmed.endsWith(';') && 
            !trimmed.endsWith('{') && 
            !trimmed.endsWith('}') &&
            !trimmed.startsWith('//') &&
            !trimmed.includes('function') &&
            trimmed.length > 5) {
            missingSemicolons++;
        }
    });
    
    if (missingSemicolons > 3) {
        analytics.potential_issues.push({
            type: 'warning',
            message: 'Multiple missing semicolons detected. Consider adding semicolons for consistency.'
        });
    }
    
    // Direct DOM manipulation
    if (/document\.(getElementById|querySelector|getElementsBy)/.test(script)) {
        analytics.potential_issues.push({
            type: 'warning',
            message: 'Direct DOM manipulation detected. Use Frappe\'s form API for better compatibility.'
        });
    }
    
    // Global variables
    if (analytics.variables_analysis.globals.length > 0) {
        analytics.potential_issues.push({
            type: 'warning',
            message: `${analytics.variables_analysis.globals.length} potential global variable(s) detected. Use var/let/const for proper scoping.`
        });
    }
    
    // console.log statements
    const consoleCount = (script.match(/console\.(log|error|warn|info)/g) || []).length;
    if (consoleCount > 0) {
        analytics.potential_issues.push({
            type: 'info',
            message: `Found ${consoleCount} console statement(s). Remove before production deployment.`
        });
    }
    
    // Synchronous server calls
    if (/async\s*:\s*false/.test(script)) {
        analytics.potential_issues.push({
            type: 'error',
            message: 'Synchronous server calls detected. This will freeze the UI - use async calls instead.'
        });
    }
    
    // High complexity
    if (analytics.complexity.cyclomatic > 10) {
        analytics.potential_issues.push({
            type: 'warning',
            message: `High cyclomatic complexity (${analytics.complexity.cyclomatic}). Consider breaking into smaller functions.`
        });
    }
    
    // Deep nesting
    if (analytics.complexity.nesting_depth > 4) {
        analytics.potential_issues.push({
            type: 'warning',
            message: `Deep nesting (level ${analytics.complexity.nesting_depth}). Refactor for better readability.`
        });
    }
    
    // No error handling
    if (analytics.patterns.server_calls && !/(try|catch|\.catch\(|\.then\()/.test(script)) {
        analytics.potential_issues.push({
            type: 'warning',
            message: 'Server calls without error handling detected. Add try-catch or .catch() handlers.'
        });
    }
    
    // Security issues
    analytics.security.issues.forEach(issue => {
        analytics.potential_issues.push({
            type: issue.type === 'high' ? 'error' : issue.type,
            message: `Security: ${issue.message} (${issue.count} occurrence${issue.count > 1 ? 's' : ''})`
        });
    });
}

function generateSuggestions(analytics, script) {
    // No validation event
    if (!analytics.patterns.validations && analytics.patterns.events.length > 0) {
        analytics.suggestions.push('Add validation logic to ensure data integrity before save.');
    }
    
    // Too few comments
    if (analytics.general.lines > 20 && analytics.general.comments < 2) {
        analytics.suggestions.push('Add comments to explain complex logic and improve maintainability.');
    }
    
    // Performance
    if (analytics.frappe_apis.total > 5) {
        analytics.suggestions.push('Consider batching multiple server calls for better performance.');
    }
    
    // Code organization
    if (analytics.general.functions < 2 && analytics.general.lines > 50) {
        analytics.suggestions.push('Break down code into smaller, reusable functions.');
    }
    
    // Event optimization
    if (analytics.patterns.events.includes('refresh') && analytics.frappe_apis.total > 3) {
        analytics.suggestions.push('Refresh event has multiple server calls. Consider caching or conditional loading.');
    }
    
    // Function-specific suggestions
    analytics.functions_list.forEach(func => {
        if (func.endLine - func.startLine > 50) {
            analytics.suggestions.push(`Function "${func.name}" is ${func.endLine - func.startLine + 1} lines long. Consider breaking it into smaller functions.`);
        }
        if (func.complexity > 10) {
            analytics.suggestions.push(`Function "${func.name}" has high complexity (${func.complexity}). Consider simplifying the logic.`);
        }
    });
    
    // Documentation suggestions
    if (analytics.documentation.score < 50) {
        analytics.suggestions.push('Improve documentation by adding JSDoc comments to functions.');
    }
    
    // Security suggestions
    if (analytics.security.score < 80) {
        analytics.suggestions.push('Address security issues to improve code safety.');
    }
    
    // Performance suggestions
    analytics.performance.recommendations.forEach(rec => {
        analytics.suggestions.push(rec);
    });
    
    // Duplication suggestions
    if (analytics.duplication.duplicates.length > 0) {
        if (analytics.duplication.duplicates.length > 5) {
            analytics.suggestions.push(`Found ${analytics.duplication.duplicates.length} significant duplicate code blocks. Extract common logic into reusable functions to improve maintainability.`);
        } else {
            analytics.suggestions.push(`Found ${analytics.duplication.duplicates.length} duplicate code block${analytics.duplication.duplicates.length > 1 ? 's' : ''}. Consider refactoring to reduce repetition.`);
        }
    }
}

function generateAnalyticsHTML(analytics) {
    const issueColors = {
        error: '#dc3545',
        warning: '#ffc107',
        info: '#17a2b8'
    };
    
    const complexityColor = analytics.complexity.cyclomatic > 10 ? '#dc3545' : 
                           analytics.complexity.cyclomatic > 5 ? '#ffc107' : '#28a745';
    
    const nestingColor = analytics.complexity.nesting_depth > 4 ? '#dc3545' : 
                        analytics.complexity.nesting_depth > 2 ? '#ffc107' : '#28a745';
    
    let html = `
    <style>
        .cs-analytics { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .cs-analytics * { box-sizing: border-box; }
        .cs-analytics h4 { margin: 0 0 20px 0; color: #2c3e50; font-size: 18px; font-weight: 600; }
        .cs-analytics h5 { margin: 0 0 10px 0; color: #34495e; font-size: 14px; font-weight: 600; }
        .cs-metric-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .cs-metric-label { color: #6c757d; font-size: 12px; margin-bottom: 5px; }
        .cs-metric-value { font-size: 28px; font-weight: 700; color: #2c3e50; line-height: 1; }
        .cs-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .cs-tag { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; margin: 4px; }
        .cs-issue { padding: 12px; margin-bottom: 8px; border-radius: 6px; display: flex; align-items: flex-start; }
        .cs-issue-icon { margin-right: 10px; font-size: 16px; }
        .cs-suggestion { padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .cs-suggestion:last-child { border-bottom: none; }
        .cs-analytics table { border-spacing: 0; }
        .cs-analytics tbody tr:hover { background-color: #f8f9fa; }
        .cs-analytics code { font-family: 'Consolas', 'Monaco', 'Courier New', monospace; }
        .cs-score-card { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 20px; 
            border-radius: 12px; 
            text-align: center; 
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .cs-score-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); 
            gap: 15px; 
            margin-top: 15px;
        }
        .cs-score-item {
            background: rgba(255,255,255,0.1);
            padding: 10px;
            border-radius: 8px;
        }
        .cs-progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        .cs-progress-fill {
            height: 100%;
            background: white;
            transition: width 0.3s ease;
        }
    </style>
    
    <div class="cs-analytics" style="padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h4>📊 Advanced Client Script Analytics</h4>
        
        <!-- Overall Score Card -->
        <div class="cs-score-card">
            <h5 style="color: white; margin-bottom: 10px; font-size: 16px;">Overall Code Quality Score</h5>
            <div style="font-size: 64px; font-weight: 700; margin: 10px 0;">
                ${calculateOverallScore(analytics)}%
            </div>
            <div class="cs-score-grid">
                <div class="cs-score-item">
                    <div style="font-size: 12px; opacity: 0.8;">Security</div>
                    <div style="font-size: 20px; font-weight: 600;">${analytics.security.score}%</div>
                    <div class="cs-progress-bar">
                        <div class="cs-progress-fill" style="width: ${analytics.security.score}%;"></div>
                    </div>
                </div>
                <div class="cs-score-item">
                    <div style="font-size: 12px; opacity: 0.8;">Documentation</div>
                    <div style="font-size: 20px; font-weight: 600;">${analytics.documentation.score}%</div>
                    <div class="cs-progress-bar">
                        <div class="cs-progress-fill" style="width: ${analytics.documentation.score}%;"></div>
                    </div>
                </div>
                <div class="cs-score-item">
                    <div style="font-size: 12px; opacity: 0.8;">Duplication</div>
                    <div style="font-size: 20px; font-weight: 600;">${analytics.duplication.score}%</div>
                    <div class="cs-progress-bar">
                        <div class="cs-progress-fill" style="width: ${analytics.duplication.score}%;"></div>
                    </div>
                </div>
                <div class="cs-score-item">
                    <div style="font-size: 12px; opacity: 0.8;">Performance</div>
                    <div style="font-size: 20px; font-weight: 600;">${calculatePerformanceScore(analytics)}%</div>
                    <div class="cs-progress-bar">
                        <div class="cs-progress-fill" style="width: ${calculatePerformanceScore(analytics)}%;"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- General Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div class="cs-metric-card">
                <div class="cs-metric-label">Lines</div>
                <div class="cs-metric-value">${analytics.general.lines}</div>
            </div>
            <div class="cs-metric-card">
                <div class="cs-metric-label">Functions</div>
                <div class="cs-metric-value">${analytics.general.functions}</div>
            </div>
            <div class="cs-metric-card">
                <div class="cs-metric-label">Variables</div>
                <div class="cs-metric-value">${analytics.general.variables}</div>
            </div>
            <div class="cs-metric-card">
                <div class="cs-metric-label">Comments</div>
                <div class="cs-metric-value">${analytics.general.comments}</div>
            </div>
            <div class="cs-metric-card">
                <div class="cs-metric-label">API Calls</div>
                <div class="cs-metric-value">${analytics.frappe_apis.total}</div>
            </div>
        </div>
        
        <!-- Complexity Analysis -->
        <div class="cs-section">
            <h5>🔧 Code Complexity</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <span style="color: #6c757d; font-size: 14px;">Cyclomatic Complexity</span>
                    <div style="margin-top: 5px;">
                        <span style="font-size: 24px; font-weight: bold; color: ${complexityColor};">
                            ${analytics.complexity.cyclomatic}
                        </span>
                        <span style="color: #6c757d; font-size: 12px; margin-left: 8px;">
                            ${analytics.complexity.cyclomatic <= 5 ? 'Simple' : 
                              analytics.complexity.cyclomatic <= 10 ? 'Moderate' : 'Complex'}
                        </span>
                    </div>
                </div>
                <div>
                    <span style="color: #6c757d; font-size: 14px;">Max Nesting Depth</span>
                    <div style="margin-top: 5px;">
                        <span style="font-size: 24px; font-weight: bold; color: ${nestingColor};">
                            ${analytics.complexity.nesting_depth}
                        </span>
                        <span style="color: #6c757d; font-size: 12px; margin-left: 8px;">
                            ${analytics.complexity.nesting_depth <= 2 ? 'Shallow' : 
                              analytics.complexity.nesting_depth <= 4 ? 'Moderate' : 'Deep'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Variable & Field Analysis -->
        ${analytics.variables_analysis ? `
        <div class="cs-section">
            <h5>📦 Variables & Fields Analysis</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                <div>
                    <h6 style="color: #6c757d; font-size: 13px; margin-bottom: 10px;">Declared Variables (${analytics.variables_analysis.declared.length})</h6>
                    <div style="max-height: 150px; overflow-y: auto;">
                        ${analytics.variables_analysis.declared.map(v => `
                            <div style="padding: 4px 0; font-size: 12px;">
                                <span style="color: ${v.type === 'const' ? '#2196f3' : v.type === 'let' ? '#4caf50' : '#ff9800'}; font-weight: 500;">
                                    ${v.type}
                                </span>
                                <code style="margin-left: 8px; background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
                                    ${v.name}
                                </code>
                            </div>
                        `).join('') || '<span style="color: #6c757d; font-size: 12px;">No variables declared</span>'}
                    </div>
                </div>
                <div>
                    <h6 style="color: #6c757d; font-size: 13px; margin-bottom: 10px;">Form Fields Accessed (${analytics.variables_analysis.fields.length})</h6>
                    <div style="max-height: 150px; overflow-y: auto;">
                        ${analytics.variables_analysis.fields.map(f => `
                            <div style="padding: 4px 0; font-size: 12px;">
                                <code style="background: #f1f3f4; padding: 2px 6px; border-radius: 3px;">
                                    ${f.name}
                                </code>
                                <span style="margin-left: 8px; color: #6c757d;">
                                    R:${f.readCount} W:${f.writeCount}
                                </span>
                            </div>
                        `).join('') || '<span style="color: #6c757d; font-size: 12px;">No fields accessed</span>'}
                    </div>
                </div>
                <div>
                    <h6 style="color: #6c757d; font-size: 13px; margin-bottom: 10px;">Potential Globals (${analytics.variables_analysis.globals.length})</h6>
                    <div style="max-height: 150px; overflow-y: auto;">
                        ${analytics.variables_analysis.globals.map(g => `
                            <div style="padding: 4px 0; font-size: 12px;">
                                <code style="background: #ffebee; color: #c62828; padding: 2px 6px; border-radius: 3px;">
                                    ${g}
                                </code>
                            </div>
                        `).join('') || '<span style="color: #28a745; font-size: 12px;">✓ No global variables</span>'}
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Security Analysis -->
        ${analytics.security ? `
        <div class="cs-section" style="${analytics.security.score < 80 ? 'border: 2px solid #dc3545;' : ''}">
            <h5>🔒 Security Analysis (Score: ${analytics.security.score}%)</h5>
            ${analytics.security.issues.length > 0 ? `
                <div style="margin-top: 10px;">
                    ${analytics.security.issues.map(issue => `
                        <div class="cs-issue" style="background: ${issue.type === 'high' ? '#ffebee' : issue.type === 'medium' ? '#fff8e1' : '#e3f2fd'};">
                            <span class="cs-issue-icon">
                                ${issue.type === 'high' ? '🚨' : issue.type === 'medium' ? '⚠️' : 'ℹ️'}
                            </span>
                            <div>
                                <strong style="color: ${issue.type === 'high' ? '#dc3545' : issue.type === 'medium' ? '#ffc107' : '#17a2b8'}; text-transform: uppercase; font-size: 11px;">
                                    ${issue.type} RISK
                                </strong>
                                <div style="margin-top: 4px; color: #495057; font-size: 14px;">
                                    ${issue.message} (${issue.count} occurrence${issue.count > 1 ? 's' : ''})
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p style="color: #28a745; margin: 10px 0;">✓ No security issues detected</p>'}
        </div>
        ` : ''}
        
        <!-- Performance Analysis -->
        ${analytics.performance ? `
        <div class="cs-section">
            <h5>⚡ Performance Analysis</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 15px;">
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: ${analytics.performance.syncCalls > 0 ? '#dc3545' : '#28a745'};">
                        ${analytics.performance.syncCalls}
                    </div>
                    <div style="font-size: 12px; color: #6c757d;">Sync Calls</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: ${analytics.performance.domManipulations > 10 ? '#ffc107' : '#28a745'};">
                        ${analytics.performance.domManipulations}
                    </div>
                    <div style="font-size: 12px; color: #6c757d;">DOM Operations</div>
                </div>
                <div style="text-align: center; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="font-size: 24px; font-weight: bold; color: ${analytics.performance.nestedLoops > 0 ? '#dc3545' : '#28a745'};">
                        ${analytics.performance.nestedLoops}
                    </div>
                    <div style="font-size: 12px; color: #6c757d;">Nested Loops</div>
                </div>
            </div>
            ${analytics.performance.recommendations.length > 0 ? `
                <div style="background: #e7f3ff; padding: 12px; border-radius: 6px; border-left: 3px solid #2196f3;">
                    <strong style="color: #1976d2; font-size: 13px;">Performance Tips:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                        ${analytics.performance.recommendations.map(rec => `
                            <li style="font-size: 13px; color: #495057; margin-bottom: 4px;">${rec}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Code Duplication -->
        ${analytics.duplication ? `
        <div class="cs-section">
            <h5>🔁 Code Duplication (Score: ${analytics.duplication.score}%)</h5>
            ${analytics.duplication.duplicates.length > 0 ? `
                <div style="background: ${analytics.duplication.score < 70 ? '#fff3cd' : '#d4edda'}; padding: 12px; border-radius: 6px; border-left: 3px solid ${analytics.duplication.score < 70 ? '#ffc107' : '#28a745'};">
                    <strong style="color: ${analytics.duplication.score < 70 ? '#856404' : '#155724'};">
                        ${analytics.duplication.duplicates.length === 0 ? '✓ No significant duplicates found' : 
                          `Found ${analytics.duplication.duplicates.length} duplicate block${analytics.duplication.duplicates.length > 1 ? 's' : ''}:`}
                    </strong>
                    ${analytics.duplication.duplicates.length > 0 ? `
                        <div style="margin-top: 10px; max-height: 300px; overflow-y: auto;">
                            ${analytics.duplication.duplicates.slice(0, 10).map((dup, index) => `
                                <div style="padding: 8px; margin-bottom: 8px; background: white; border-radius: 4px; font-size: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <strong>Duplicate #${index + 1}</strong>
                                        <span style="color: #6c757d; font-size: 11px;">
                                            ${dup.size} lines
                                        </span>
                                    </div>
                                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 4px;">
                                        <span style="background: #e3f2fd; padding: 2px 8px; border-radius: 3px; font-family: monospace; font-size: 11px;">
                                            Lines ${dup.lines1}
                                        </span>
                                        <span style="color: #6c757d;">↔</span>
                                        <span style="background: #e3f2fd; padding: 2px 8px; border-radius: 3px; font-family: monospace; font-size: 11px;">
                                            Lines ${dup.lines2}
                                        </span>
                                    </div>
                                    <div style="margin-top: 4px; padding: 6px; background: #f8f9fa; border-radius: 3px; font-family: monospace; font-size: 11px; color: #495057; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${dup.content}
                                    </div>
                                </div>
                            `).join('')}
                            ${analytics.duplication.duplicates.length > 10 ? `
                                <div style="text-align: center; padding: 10px; color: #6c757d; font-size: 12px;">
                                    ... and ${analytics.duplication.duplicates.length - 10} more duplicate blocks
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
                ${analytics.duplication.score < 70 ? `
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 13px; color: #495057;">
                        💡 <strong>Tip:</strong> Consider extracting duplicate code into reusable functions to improve maintainability and reduce code size.
                    </div>
                ` : ''}
                <div style="margin-top: 10px; padding: 8px; background: #e3f2fd; border-radius: 4px; font-size: 11px; color: #1976d2;">
                    <strong>Note:</strong> Only significant duplicates (5+ lines, 100+ characters) are shown. Common patterns like variable declarations are filtered out.
                </div>
            ` : `
                <div style="padding: 20px; text-align: center; background: #d4edda; border-radius: 6px; color: #155724;">
                    <div style="font-size: 24px; margin-bottom: 5px;">✓</div>
                    <strong>Excellent!</strong> No significant code duplication detected.
                </div>
            `}
        </div>
        ` : ''}
        
        <!-- Documentation Analysis -->
        ${analytics.documentation ? `
        <div class="cs-section">
            <h5>📝 Documentation Analysis (Score: ${analytics.documentation.score}%)</h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="color: #6c757d; font-size: 12px;">File Header</div>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 5px;">
                        ${analytics.documentation.hasFileHeader ? 
                            '<span style="color: #28a745;">✓ Present</span>' : 
                            '<span style="color: #dc3545;">✗ Missing</span>'}
                    </div>
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="color: #6c757d; font-size: 12px;">Documented Functions</div>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 5px;">
                        ${analytics.documentation.functionsDocs} / ${analytics.functions_list.length}
                    </div>
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="color: #6c757d; font-size: 12px;">Total Comments</div>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 5px;">
                        ${analytics.documentation.totalComments}
                    </div>
                </div>
                <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <div style="color: #6c757d; font-size: 12px;">TODO/FIXME</div>
                    <div style="font-size: 16px; font-weight: 600; margin-top: 5px;">
                        ${analytics.documentation.todoComments.length}
                    </div>
                </div>
            </div>
            ${analytics.documentation.todoComments.length > 0 ? `
                <div style="margin-top: 15px; background: #fff3cd; padding: 10px; border-radius: 6px;">
                    <strong style="font-size: 13px; color: #856404;">TODO Comments:</strong>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px;">
                        ${analytics.documentation.todoComments.map(todo => `
                            <li style="font-size: 12px; font-family: monospace; color: #495057;">${todo}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
        ` : ''}
        
        <!-- Functions Table -->
        ${analytics.functions_list.length > 0 ? `
        <div class="cs-section">
            <h5>🔍 Functions List (${analytics.functions_list.length})</h5>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 12px; text-align: left; font-weight: 600;">#</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Function Name</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Type</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Start Line</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">End Line</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Lines</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Complexity</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">📝</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${analytics.functions_list.map((func, index) => {
                            const lines = func.endLine - func.startLine + 1;
                            const typeColors = {
                                'named': '#2196f3',
                                'variable': '#4caf50',
                                'arrow': '#ff9800',
                                'method': '#9c27b0',
                                'arrow-method': '#f44336',
                                'shorthand': '#00bcd4'
                            };
                            const complexityColor = func.complexity > 5 ? '#dc3545' : 
                                                   func.complexity > 3 ? '#ffc107' : '#28a745';
                            
                            return `
                            <tr style="border-bottom: 1px solid #e9ecef;">
                                <td style="padding: 10px; color: #6c757d;">${index + 1}</td>
                                <td style="padding: 10px; font-weight: 500; color: #2c3e50;">
                                    <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">
                                        ${func.name}
                                    </code>
                                    ${func.parameters.length > 0 ? `
                                        <span style="color: #6c757d; font-size: 11px; margin-left: 4px;">
                                            (${func.parameters.join(', ')})
                                        </span>
                                    ` : ''}
                                </td>
                                <td style="padding: 10px;">
                                    <span style="color: ${typeColors[func.type] || '#6c757d'}; font-size: 12px;">
                                        ${func.type}
                                    </span>
                                </td>
                                <td style="padding: 10px; text-align: center; font-family: monospace;">
                                    ${func.startLine}
                                </td>
                                <td style="padding: 10px; text-align: center; font-family: monospace;">
                                    ${func.endLine}
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <span style="color: ${lines > 50 ? '#dc3545' : lines > 20 ? '#ffc107' : '#28a745'};">
                                        ${lines}
                                    </span>
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    <span style="font-weight: bold; color: ${complexityColor};">
                                        ${func.complexity}
                                    </span>
                                </td>
                                <td style="padding: 10px; text-align: center;">
                                    ${func.hasDocumentation ? 
                                        '<span style="color: #28a745;">✓</span>' : 
                                        '<span style="color: #dc3545;">✗</span>'}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 10px; font-size: 12px; color: #6c757d;">
                <strong>Type Legend:</strong> 
                <span style="color: #2196f3;">named</span> = Regular function • 
                <span style="color: #4caf50;">variable</span> = Function expression • 
                <span style="color: #ff9800;">arrow</span> = Arrow function • 
                <span style="color: #9c27b0;">method</span> = Object method • 
                <span style="color: #00bcd4;">shorthand</span> = ES6 method
            </div>
        </div>
        ` : ''}
        
        <!-- Frappe API Usage -->
        ${analytics.frappe_apis.calls.length > 0 ? `
        <div class="cs-section">
            <h5>🔌 Frappe API Usage</h5>
            <div style="display: flex; flex-wrap: wrap; margin: -4px;">
                ${analytics.frappe_apis.calls.map(call => `
                    <span class="cs-tag" style="background: #e3f2fd; color: #1976d2;">
                        ${call.api} <strong>(${call.count})</strong>
                    </span>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Events & Patterns -->
        ${analytics.patterns.events.length > 0 || analytics.patterns.validations || analytics.patterns.server_calls ? `
        <div class="cs-section">
            <h5>🎯 Events & Patterns</h5>
            <div style="display: flex; flex-wrap: wrap; margin: -4px;">
                ${analytics.patterns.events.map(event => `
                    <span class="cs-tag" style="background: #f3e5f5; color: #7b1fa2;">
                        ${event}
                    </span>
                `).join('')}
                ${analytics.patterns.validations ? '<span class="cs-tag" style="background: #e8f5e9; color: #388e3c;">✓ Validation</span>' : ''}
                ${analytics.patterns.server_calls ? '<span class="cs-tag" style="background: #fff3e0; color: #f57c00;">⚡ Server Calls</span>' : ''}
            </div>
        </div>
        ` : ''}
        
        <!-- Issues -->
        ${analytics.potential_issues.length > 0 ? `
        <div class="cs-section">
            <h5>⚠️ Potential Issues (${analytics.potential_issues.length})</h5>
            ${analytics.potential_issues.map(issue => `
                <div class="cs-issue" style="background: ${issue.type === 'error' ? '#ffebee' : issue.type === 'warning' ? '#fff8e1' : '#e3f2fd'};">
                    <span class="cs-issue-icon">
                        ${issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'}
                    </span>
                    <div>
                        <strong style="color: ${issueColors[issue.type]}; text-transform: uppercase; font-size: 11px;">
                            ${issue.type}
                        </strong>
                        <div style="margin-top: 4px; color: #495057; font-size: 14px;">${issue.message}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <!-- Suggestions -->
        ${analytics.suggestions.length > 0 ? `
        <div class="cs-section">
            <h5>💡 Suggestions for Improvement</h5>
            <div>
                ${analytics.suggestions.map(suggestion => `
                    <div class="cs-suggestion">
                        <span style="color: #28a745; margin-right: 8px;">✓</span>
                        <span style="color: #495057; font-size: 14px;">${suggestion}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    </div>
    `;
    
    return html;
}

function calculateQualityScore(analytics) {
    let score = 100;
    
    // Deduct for issues
    analytics.potential_issues.forEach(issue => {
        if (issue.type === 'error') score -= 10;
        else if (issue.type === 'warning') score -= 5;
        else score -= 2;
    });
    
    // Deduct for complexity
    if (analytics.complexity.cyclomatic > 10) score -= 10;
    else if (analytics.complexity.cyclomatic > 5) score -= 5;
    
    if (analytics.complexity.nesting_depth > 4) score -= 10;
    else if (analytics.complexity.nesting_depth > 2) score -= 5;
    
    // Deduct for lack of comments
    const commentRatio = analytics.general.comments / Math.max(analytics.general.lines, 1);
    if (commentRatio < 0.05 && analytics.general.lines > 20) score -= 5;
    
    // Bonus for good practices
    if (analytics.patterns.validations) score += 5;
    if (analytics.patterns.events.length > 0) score += 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateOverallScore(analytics) {
    const scores = [
        calculateQualityScore(analytics),
        analytics.security.score,
        analytics.documentation.score,
        analytics.duplication.score,
        calculatePerformanceScore(analytics)
    ];
    
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    return Math.round(avgScore);
}

function calculatePerformanceScore(analytics) {
    let score = 100;
    
    if (analytics.performance.syncCalls > 0) score -= 20 * analytics.performance.syncCalls;
    if (analytics.performance.domManipulations > 10) score -= 10;
    if (analytics.performance.nestedLoops > 0) score -= 15 * analytics.performance.nestedLoops;
    if (analytics.frappe_apis.total > 10) score -= 10;
    
    return Math.max(0, Math.min(100, score));
}

function getQualityMessage(score) {
    if (score >= 90) return "Excellent code quality! Keep up the great work.";
    if (score >= 75) return "Good code quality with minor improvements needed.";
    if (score >= 60) return "Fair code quality. Consider addressing the issues.";
    if (score >= 40) return "Code needs improvement. Review suggestions carefully.";
    return "Code requires significant refactoring.";
}
