function Garrisonable() {}

Garrisonable.prototype.Schema =
	"<a:help>Controls the garrisonability of an entity.</a:help>" +
	"<a:example>" +
		"<Size>10</Size>" +
	"</a:example>" +
	"<element name='Size' a:help='Number of garrison slots the entity occupies.'>" +
		"<data type='nonNegativeInteger'/>" +
	"</element>";

Garrisonable.prototype.Init = function()
{
};

/**
 * @return {number} - The number of slots this unit takes in a garrisonHolder.
 */
Garrisonable.prototype.UnitSize = function()
{
	return ApplyValueModificationsToEntity("Garrisonable/Size", +this.template.Size, this.entity);
};

/**
 * Calculates the number of slots this unit takes in a garrisonHolder by
 * adding the number of garrisoned slots to the equation.
 *
 * @return {number} - The number of slots this unit and its garrison takes in a garrisonHolder.
 */
Garrisonable.prototype.TotalSize = function()
{
	let size = this.UnitSize();
	let cmpGarrisonHolder = Engine.QueryInterface(this.entity, IID_GarrisonHolder);
	if (cmpGarrisonHolder)
		size += cmpGarrisonHolder.OccupiedSlots();
	return size;
};

/**
 * @return {number} - The entity ID of the entity this entity is garrisoned in.
 */
Garrisonable.prototype.HolderID = function()
{
	return this.holder || INVALID_ENTITY;
};

/**
 * @param {number} - The entity ID to check.
 * @return {boolean} - Whether we can garrison.
 */
Garrisonable.prototype.CanGarrison = function(entity)
{
	let cmpGarrisonHolder = Engine.QueryInterface(entity, IID_GarrisonHolder);
	return cmpGarrisonHolder && cmpGarrisonHolder.IsAllowedToGarrison(this.entity);
};

/**
 * @param {number} entity - The entity ID of the entity this entity is being garrisoned in.
 * @return {boolean} - Whether garrisoning succeeded.
 */
Garrisonable.prototype.Garrison = function(entity, renamed = false)
{
	if (this.holder)
		return false;

	let cmpGarrisonHolder = Engine.QueryInterface(entity, IID_GarrisonHolder);
	if (!cmpGarrisonHolder || !cmpGarrisonHolder.Garrison(this.entity))
		return false;

	this.holder = entity;

	let cmpProductionQueue = Engine.QueryInterface(this.entity, IID_ProductionQueue);
	if (cmpProductionQueue)
		cmpProductionQueue.PauseProduction();

	let cmpAura = Engine.QueryInterface(this.entity, IID_Auras);
	if (cmpAura && cmpAura.HasGarrisonAura())
		cmpAura.ApplyGarrisonAura(entity);

	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (cmpPosition)
		cmpPosition.MoveOutOfWorld();

	if (renamed)
		return true;

	let cmpTurretHolder = Engine.QueryInterface(entity, IID_TurretHolder);
	if (cmpTurretHolder)
		cmpTurretHolder.OccupyTurret(this.entity);

	return true;
};

/**
 * Called on game init when the entity was part of init garrison.
 * @param {number} entity - The entityID to autogarrison.
 * @return {boolean} - Whether garrisoning succeeded.
 */
Garrisonable.prototype.Autogarrison = function(entity)
{
	if (!this.Garrison(entity))
		return false;

	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (cmpUnitAI)
		cmpUnitAI.Autogarrison(this.entity);
	return true;
};

/**
 * @param {boolean} forced - Optionally whether the spawning is forced.
 * @param {boolean} renamed - Optionally whether the ungarrisoning is due to renaming.
 * @return {boolean} - Whether the ungarrisoning succeeded.
 */
Garrisonable.prototype.UnGarrison = function(forced = false, renamed = false)
{
	let cmpPosition = Engine.QueryInterface(this.entity, IID_Position);
	if (cmpPosition)
	{
		let pos;
		let cmpGarrisonHolder = Engine.QueryInterface(this.holder, IID_GarrisonHolder);
		if (cmpGarrisonHolder)
			pos = cmpGarrisonHolder.GetSpawnPosition(this.entity, forced);

		if (!pos)
			return false;

		cmpPosition.JumpTo(pos.x, pos.z);
		cmpPosition.SetHeightOffset(0);

		let cmpHolderPosition = Engine.QueryInterface(this.holder, IID_Position);
		if (cmpHolderPosition)
			cmpPosition.SetYRotation(cmpHolderPosition.GetPosition().horizAngleTo(pos));
	}

	let cmpUnitAI = Engine.QueryInterface(this.entity, IID_UnitAI);
	if (cmpUnitAI)
		cmpUnitAI.Ungarrison();

	let cmpProductionQueue = Engine.QueryInterface(this.entity, IID_ProductionQueue);
	if (cmpProductionQueue)
		cmpProductionQueue.UnpauseProduction();

	let cmpAura = Engine.QueryInterface(this.entity, IID_Auras);
	if (cmpAura && cmpAura.HasGarrisonAura())
		cmpAura.RemoveGarrisonAura(this.holder);

	if (renamed)
		return true;

	let cmpTurretHolder = Engine.QueryInterface(this.holder, IID_TurretHolder);
	if (cmpTurretHolder)
		cmpTurretHolder.LeaveTurret(this.entity);

	delete this.holder;
	return true;
};

Garrisonable.prototype.OnEntityRenamed = function(msg)
{
	if (!this.holder)
		return;

	let cmpGarrisonHolder = Engine.QueryInterface(this.holder, IID_GarrisonHolder);
	if (cmpGarrisonHolder)
	{
		// ToDo: Clean this by using cmpGarrisonable to ungarrison.
		cmpGarrisonHolder.Eject(msg.entity, true, true);
		let cmpGarrisonable = Engine.QueryInterface(msg.newentity, IID_Garrisonable);
		if (cmpGarrisonable)
			cmpGarrisonable.Garrison(this.holder, true);
	}

	// We process EntityRenamed of turrets here because we need to be sure that we
	// receive it after it is processed by GarrisonHolder.js.
	// ToDo: Make this not needed by fully separating TurretHolder from GarrisonHolder.
	// That means an entity with TurretHolder should not need a GarrisonHolder
	// for e.g. the garrisoning logic.
	let cmpTurretHolder = Engine.QueryInterface(this.holder, IID_TurretHolder);
	if (cmpTurretHolder)
		cmpTurretHolder.SwapEntities(msg.entity, msg.newentity);

	delete this.holder;
};

Engine.RegisterComponentType(IID_Garrisonable, "Garrisonable", Garrisonable);
