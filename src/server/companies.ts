import { companyData } from "@/server/company-data";
import {
	CompanyCatalogSchema,
	type Company,
	type CompanyMethod,
} from "@/server/company-schema";

const result = CompanyCatalogSchema.parse(companyData);
if (result.issues) {
	throw new Error(`Invalid company catalog: ${result.issues.join("; ")}`);
}

export const companies = result.data;

export function getCompany(slug: string) {
	return companies.find((company) => company.slug === slug);
}

export function requireCompany(slug: string) {
	const company = getCompany(slug);
	if (!company) {
		throw new Error(`Unknown company: ${slug}`);
	}
	return company;
}

export function getCompanyMethods(company: Company) {
	return company.methods;
}

export function getCompanyMethod(company: Company, id: string) {
	return company.methods.find((method) => method.id === id);
}

export function requireCompanyMethod(company: Company, id: string) {
	const method = getCompanyMethod(company, id);
	if (!method) {
		throw new Error(`Unknown method ${id} for ${company.slug}`);
	}
	return method;
}

export type { Company, CompanyMethod };
