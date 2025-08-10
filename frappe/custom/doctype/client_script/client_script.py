# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: MIT. See LICENSE
import frappe
from frappe.model.document import Document


class ClientScript(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		client_script_analytic: DF.TextEditor | None
		client_script_analytic_by_user: DF.TextEditor | None
		documentation: DF.Attach | None
		documentation_2: DF.Attach | None
		documentation_3: DF.Attach | None
		dt: DF.Link
		enabled: DF.Check
		module: DF.Link | None
		notes: DF.SmallText | None
		reference_app: DF.Link | None
		script: DF.Code | None
		script_code_name: DF.Data | None
		version: DF.Data | None
		version_log: DF.Data | None
		view: DF.Literal["List", "Form"]
	# end: auto-generated types
	def on_update(self):
		frappe.clear_cache(doctype=self.dt)

	def on_trash(self):
		frappe.clear_cache(doctype=self.dt)
