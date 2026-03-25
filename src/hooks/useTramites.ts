// src/hooks/useTramites.ts

export const useTramiteMutations = () => {
    const vincularFolio = async (tramiteId: string, expedientePadreId: string) => {
        const token = localStorage.getItem('jwt_token');
        
        const response = await fetch(`/api/v1/tramites/${tramiteId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                expediente_relacionado_id: expedientePadreId,
                notas_cierre: "Oficio agregado al expediente principal."
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Fallo en la vinculación" }));
            throw new Error(errorData.message || "Fallo en la vinculación");
        }
        
        return response.json();
    };

    const cambiarStatus = async (tramiteId: string, status: string) => {
        const token = localStorage.getItem('jwt_token');
        
        const response = await fetch(`/api/v1/tramites/${tramiteId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Error al cambiar estado" }));
            throw new Error(errorData.message || "Error al cambiar estado");
        }
        
        return response.json();
    };

    const asignarResponsable = async (tramiteId: string, responsableId: string) => {
        const token = localStorage.getItem('jwt_token');
        
        const response = await fetch(`/api/v1/tramites/${tramiteId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                responsable_id: responsableId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: "Error al asignar responsable" }));
            throw new Error(errorData.message || "Error al asignar responsable");
        }
        
        return response.json();
    };

    return { vincularFolio, cambiarStatus, asignarResponsable };
};
